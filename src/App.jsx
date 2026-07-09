import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Practice from './pages/Practice.jsx';
import KnowledgePractice from './pages/KnowledgePractice.jsx';
import FunPractice from './pages/FunPractice.jsx';
import AbilityPractice from './pages/AbilityPractice.jsx';
import Quiz from './pages/Quiz.jsx';
import Result from './pages/Result.jsx';
import Mistakes from './pages/Mistakes.jsx';
import Profile from './pages/Profile.jsx';
import DiagnosisDemo from './pages/DiagnosisDemo.jsx';
import TrainingPlanDemo from './pages/TrainingPlanDemo.jsx';
import TrainingEvidenceDemo from './pages/TrainingEvidenceDemo.jsx';
import StudentProfileDemo from './pages/StudentProfileDemo.jsx';
import RealAIDiagnosisDemo from './pages/RealAIDiagnosisDemo.jsx';
import PersonalizedNextTaskDemo from './pages/PersonalizedNextTaskDemo.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/practice/knowledge" element={<KnowledgePractice />} />
        <Route path="/practice/fun" element={<FunPractice />} />
        <Route path="/practice/ability" element={<AbilityPractice />} />
        <Route path="/quiz/:category" element={<Quiz />} />
        <Route path="/result" element={<Result />} />
        <Route path="/mistakes" element={<Mistakes />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/diagnosis-demo" element={<DiagnosisDemo />} />
        <Route path="/training-plan-demo" element={<TrainingPlanDemo />} />
        <Route path="/training-evidence-demo" element={<TrainingEvidenceDemo />} />
        <Route path="/student-profile-demo" element={<StudentProfileDemo />} />
        <Route path="/real-ai-diagnosis-demo" element={<RealAIDiagnosisDemo />} />
        <Route path="/personalized-next-task-demo" element={<PersonalizedNextTaskDemo />} />
      </Routes>
    </Layout>
  );
}
