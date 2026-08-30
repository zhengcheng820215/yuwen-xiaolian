import { Navigate, useParams } from 'react-router-dom';
import { knowledgeQuizPath, resolveLegacyStudentRoute } from '../domain/student-learning-hub/studentLearningHubProjection.ts';

export function LegacyStudentRouteRedirect({ from }) {
  const { category } = useParams();
  const target = from === '/quiz/:category'
    ? knowledgeQuizPath(category || 'all')
    : resolveLegacyStudentRoute(from, category) || '/learning';
  return <Navigate to={target} replace />;
}
