import { createContext, useContext, useMemo, useState } from 'react';
import questions from '../data/questions.json';
import progress from '../data/userProgress.json';

const StudyContext = createContext(null);

export function StudyProvider({ children }) {
  const [mistakes, setMistakes] = useState(
    progress.recentMistakes.map((item) => {
      const source = questions.find((question) => question.id === item.id);
      return {
        ...source,
        wrongAnswer: '未复习',
        mastered: false,
      };
    }),
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
      return [{ ...question, wrongAnswer, mastered: false }, ...next];
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
