import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
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
import PersonalizedTaskExecutionDemo from './pages/PersonalizedTaskExecutionDemo.jsx';
import BetaLearningEntryDemo from './pages/BetaLearningEntryDemo.jsx';
import BetaPersonalizedTrainingDemo from './pages/BetaPersonalizedTrainingDemo.jsx';
import BetaSessionResultDemo from './pages/BetaSessionResultDemo.jsx';
import Phase81EvaluationDemo from './pages/Phase81EvaluationDemo.jsx';
import Phase82GrowthMemoryDemo from './pages/Phase82GrowthMemoryDemo.jsx';
import Phase83NextStrategyDemo from './pages/Phase83NextStrategyDemo.jsx';
import Phase84TaskFulfillmentDemo from './pages/Phase84TaskFulfillmentDemo.jsx';
import Phase10LearningRoundDemo from './pages/Phase10LearningRoundDemo.jsx';
import StudentLearningEntryDemo from './pages/StudentLearningEntryDemo.jsx';
import TaskResourcePreparationDemo from './pages/TaskResourcePreparationDemo.jsx';
import ContinuousLearningDemo from './pages/ContinuousLearningDemo.jsx';
import Phase15IntegrationDemo from './pages/Phase15IntegrationDemo.jsx';
import QuestionResourceWorkbench from './pages/QuestionResourceWorkbench.jsx';
import ResourceMatchingQualityDemo from './pages/ResourceMatchingQualityDemo.jsx';
import Phase163RealLearningChainDemo from './pages/Phase163RealLearningChainDemo.jsx';
import UnifiedLearningEntry from './pages/UnifiedLearningEntry.jsx';
import InternalLearningReview from './pages/InternalLearningReview.jsx';
import Phase163UnifiedEntryDemo from './pages/Phase163UnifiedEntryDemo.jsx';
import Phase163MultiDayOperationDemo from './pages/Phase163MultiDayOperationDemo.jsx';
import InternalHub from './pages/InternalHub.jsx';
import InternalAcceptanceHub from './pages/InternalAcceptanceHub.jsx';
import LearningCollectionIntegrity from './pages/LearningCollectionIntegrity.jsx';
import ResourceCoverageDashboardDemo from './pages/ResourceCoverageDashboardDemo.jsx';
import MaterialResourceProductionWorkbench from './pages/MaterialResourceProductionWorkbench.jsx';
import StudentLearningNarrativeCalibrationDemo from './pages/StudentLearningNarrativeCalibrationDemo.jsx';
import Phase175QuestionQualityDemo from './pages/Phase175QuestionQualityDemo.jsx';
import Phase175C1SemanticQualityDemo from './pages/Phase175C1SemanticQualityDemo.jsx';
import Phase175C2QualityPersistenceDemo from './pages/Phase175C2QualityPersistenceDemo.jsx';
import Phase175C3ABatchQualitySummaryDemo from './pages/Phase175C3ABatchQualitySummaryDemo.jsx';
import ReadingSingleChoiceStage4Acceptance from './pages/ReadingSingleChoiceStage4Acceptance.jsx';
import TargetedMicroTrainingStage4Control from './pages/TargetedMicroTrainingStage4Control.jsx';
import ReadingOpenResponseStage4BrowserAcceptance from './pages/ReadingOpenResponseStage4BrowserAcceptance.jsx';
import ReadingTrainingProgressionStage3BrowserAcceptance from './pages/ReadingTrainingProgressionStage3BrowserAcceptance.jsx';
import ProgressiveLoadStage4Review from './pages/ProgressiveLoadStage4Review.jsx';
import ReadingTrainingProgressionStage4BrowserAcceptance from './pages/ReadingTrainingProgressionStage4BrowserAcceptance.jsx';
import ProductComplexityConvergenceStage0BrowserAcceptance from './pages/ProductComplexityConvergenceStage0BrowserAcceptance.jsx';
import ProductComplexityConvergenceStage1BrowserAcceptance from './pages/ProductComplexityConvergenceStage1BrowserAcceptance.jsx';
import ProductComplexityConvergenceStage2BrowserAcceptance from './pages/ProductComplexityConvergenceStage2BrowserAcceptance.jsx';
import ProductComplexityConvergenceStage3BrowserAcceptance from './pages/ProductComplexityConvergenceStage3BrowserAcceptance.jsx';
import ProductComplexityConvergenceStage4BrowserAcceptance from './pages/ProductComplexityConvergenceStage4BrowserAcceptance.jsx';
import ProductComplexityConvergenceStage4Observation from './pages/ProductComplexityConvergenceStage4Observation.jsx';
import ProductComplexityConvergenceStage4Preflight from './pages/ProductComplexityConvergenceStage4Preflight.jsx';
import ProductComplexityConvergenceStage4RealTrialPreflightBrowserAcceptance from './pages/ProductComplexityConvergenceStage4RealTrialPreflightBrowserAcceptance.jsx';
import ProductRuntimeReliabilityWPR0Acceptance from './pages/ProductRuntimeReliabilityWPR0Acceptance.jsx';
import ProductRuntimeHealth from './pages/ProductRuntimeHealth.jsx';
import ProductRuntimeReliabilityWPR1Acceptance from './pages/ProductRuntimeReliabilityWPR1Acceptance.jsx';
import ProductRuntimeReliabilityWPR2Acceptance from './pages/ProductRuntimeReliabilityWPR2Acceptance.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/learning" replace />} />
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
        <Route path="/personalized-task-execution-demo" element={<PersonalizedTaskExecutionDemo />} />
        <Route path="/beta-learning-entry-demo" element={<BetaLearningEntryDemo />} />
        <Route path="/beta-personalized-training-demo" element={<BetaPersonalizedTrainingDemo />} />
        <Route path="/beta-session-result-demo" element={<BetaSessionResultDemo />} />
        <Route path="/phase81-evaluation-demo" element={<Phase81EvaluationDemo />} />
        <Route path="/phase82-growth-memory-demo" element={<Phase82GrowthMemoryDemo />} />
        <Route path="/phase83-next-strategy-demo" element={<Phase83NextStrategyDemo />} />
        <Route path="/phase84-task-fulfillment-demo" element={<Phase84TaskFulfillmentDemo />} />
        <Route path="/phase10-learning-round-demo" element={<Phase10LearningRoundDemo />} />
        <Route path="/student-learning-entry-demo" element={<StudentLearningEntryDemo />} />
        <Route path="/task-resource-preparation-demo" element={<TaskResourcePreparationDemo />} />
        <Route path="/continuous-learning-demo" element={<ContinuousLearningDemo />} />
        <Route path="/phase15-integration-demo" element={<Phase15IntegrationDemo />} />
        <Route path="/question-resource-workbench" element={<QuestionResourceWorkbench />} />
        <Route path="/resource-matching-quality-demo" element={<ResourceMatchingQualityDemo />} />
        <Route path="/phase16-3-real-chain-demo" element={<Phase163RealLearningChainDemo />} />
        <Route path="/learning" element={<UnifiedLearningEntry />} />
        <Route path="/internal" element={<InternalHub />} />
        <Route path="/internal/acceptance" element={<InternalAcceptanceHub />} />
        <Route path="/internal/acceptance/reading-single-choice" element={<ReadingSingleChoiceStage4Acceptance />} />
        <Route path="/internal/acceptance/reading-open-response-stage4" element={<ReadingOpenResponseStage4BrowserAcceptance />} />
        <Route path="/internal/acceptance/reading-training-progression-stage3" element={<ReadingTrainingProgressionStage3BrowserAcceptance />} />
        <Route path="/internal/acceptance/reading-training-progression-stage4" element={<ReadingTrainingProgressionStage4BrowserAcceptance />} />
        <Route path="/internal/acceptance/product-complexity-convergence-stage0" element={<ProductComplexityConvergenceStage0BrowserAcceptance />} />
        <Route path="/internal/acceptance/product-complexity-convergence-stage1" element={<ProductComplexityConvergenceStage1BrowserAcceptance />} />
        <Route path="/internal/acceptance/product-complexity-convergence-stage2" element={<ProductComplexityConvergenceStage2BrowserAcceptance />} />
        <Route path="/internal/acceptance/product-complexity-convergence-stage3" element={<ProductComplexityConvergenceStage3BrowserAcceptance />} />
        <Route path="/internal/acceptance/product-complexity-convergence-stage4" element={<ProductComplexityConvergenceStage4BrowserAcceptance />} />
        <Route path="/internal/acceptance/product-complexity-convergence-stage4-real-trial-preflight" element={<ProductComplexityConvergenceStage4RealTrialPreflightBrowserAcceptance />} />
        <Route path="/internal/acceptance/product-runtime-reliability-wp-r0" element={<ProductRuntimeReliabilityWPR0Acceptance />} />
        <Route path="/internal/acceptance/product-runtime-reliability-wp-r1" element={<ProductRuntimeReliabilityWPR1Acceptance />} />
        <Route path="/internal/acceptance/product-runtime-reliability-wp-r2" element={<ProductRuntimeReliabilityWPR2Acceptance />} />
        <Route path="/internal/runtime-health" element={<ProductRuntimeHealth />} />
        <Route path="/internal/product-complexity-convergence-stage4" element={<ProductComplexityConvergenceStage4Observation />} />
        <Route path="/internal/product-complexity-convergence-stage4-preflight" element={<ProductComplexityConvergenceStage4Preflight />} />
        <Route path="/internal/reading-training-progression-stage4" element={<ProgressiveLoadStage4Review />} />
        <Route path="/internal/learning-review" element={<InternalLearningReview />} />
        <Route path="/internal/learning-collection" element={<LearningCollectionIntegrity />} />
        <Route path="/internal/targeted-micro-training" element={<TargetedMicroTrainingStage4Control />} />
        <Route path="/phase16-3-unified-entry-demo" element={<Phase163UnifiedEntryDemo />} />
        <Route path="/phase16-3-multiday-operation-demo" element={<Phase163MultiDayOperationDemo />} />
        <Route path="/resource-coverage-dashboard-demo" element={<ResourceCoverageDashboardDemo />} />
        <Route path="/material-resource-workbench" element={<MaterialResourceProductionWorkbench />} />
        <Route path="/student-learning-narrative-calibration-demo" element={<StudentLearningNarrativeCalibrationDemo />} />
        <Route path="/phase17-5-question-quality-demo" element={<Phase175QuestionQualityDemo />} />
        <Route path="/phase17-5c1-semantic-quality-demo" element={<Phase175C1SemanticQualityDemo />} />
        <Route path="/phase17-5c2-quality-persistence-demo" element={<Phase175C2QualityPersistenceDemo />} />
        <Route path="/phase17-5c3a-batch-quality-summary-demo" element={<Phase175C3ABatchQualitySummaryDemo />} />
      </Routes>
    </Layout>
  );
}
