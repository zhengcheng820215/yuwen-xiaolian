import { createContext, useContext, useMemo, useState } from 'react';
import progress from '../data/userProgress.json';
import {
  getKnowledgeQuestionDisplayAnswer,
  knowledgeQuestionRepository,
} from '../domain/knowledge-practice/questions/knowledgeQuestionRepository.ts';

const questions = knowledgeQuestionRepository.listApproved();

const StudyContext = createContext(null);

export function StudyProvider({ children }) {
  const [mistakes, setMistakes] = useState(
    progress.recentMistakes.map((item) => {
      const source = questions.find((question) => question.id === item.id);
      if (!source) return null;
      return {
        ...source,
        wrongAnswer: '未复习',
        correctAnswerText: getKnowledgeQuestionDisplayAnswer(source),
        mastered: false,
      };
    }).filter(Boolean),
  );
  const [lastResult, setLastResult] = useState({
    score: 0,
    correct: 0,
    total: 0,
    accuracy: 0,
    duration: '0 分钟',
    mistakeCount: 0,
    category: '知识练习',
  });

  const addMistake = (question, wrongAnswer) => {
    setMistakes((current) => {
      const next = current.filter((item) => item.id !== question.id);
      const wrongAnswerText = question.options?.find((option) => option.id === wrongAnswer)?.text || wrongAnswer;
      return [{
        ...question,
        wrongAnswer: wrongAnswerText,
        correctAnswerText: getKnowledgeQuestionDisplayAnswer(question),
        mastered: false,
      }, ...next];
    });
  };

  const markMastered = (id) => {
    setMistakes((current) =>
      current.map((item) => (item.id === id ? { ...item, mastered: true } : item)),
    );
  };

  const activeMistakes = useMemo(
    () => mistakes.filter((item) => !item.mastered),
    [mistakes],
  );

  return (
    <StudyContext.Provider
      value={{
        progress,
        mistakes,
        activeMistakes,
        addMistake,
        markMastered,
        lastResult,
        setLastResult,
      }}
    >
      {children}
    </StudyContext.Provider>
  );
}

export function useStudy() {
  return useContext(StudyContext);
}
