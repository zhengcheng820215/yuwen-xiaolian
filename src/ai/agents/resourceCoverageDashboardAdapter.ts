import { buildStableId } from './reviewedResourceCandidateAdapter.ts';
import type {
  ResourceCoverageDashboardViewModel,
  ResourceCoverageGapCode,
  ResourceCoverageReport,
} from '../schemas/resourceCoverage.schema.ts';

export function buildResourceCoverageDashboardViewModel(
  report: ResourceCoverageReport,
): ResourceCoverageDashboardViewModel {
  const gapsByCell = new Map<string, ResourceCoverageGapCode[]>();
  report.gaps.forEach((gap) => {
    const key = cellKey(gap.cellKey.abilityId, gap.cellKey.taskRole);
    const values = gapsByCell.get(key) || [];
    values.push(gap.code);
    gapsByCell.set(key, values);
  });

  return {
    reportId: report.reportId,
    registrySnapshotId: report.registrySnapshot.registrySnapshotId,
    policyId: report.policyId,
    capabilitySnapshotId: report.capabilitySnapshotId,
    cells: report.cells.map((cell) => {
      const key = cellKey(cell.key.abilityId, cell.key.taskRole);
      return {
        cellId: buildStableId('resource-coverage-dashboard-cell', [report.reportId, key]),
        abilityId: cell.key.abilityId,
        taskRole: cell.key.taskRole,
        status: cell.status,
        executableResourceCount: cell.executableResourceCount,
        materialClusterCount: cell.materialClusterCount,
        independentContextCount: cell.independentContextCount,
        gapCodes: uniqueSorted(gapsByCell.get(key) || []),
      };
    }),
    materialClusters: report.materialClusters,
    summary: report.summary,
    rejectedRecordCount: report.rejectedRecords.length,
    generatedAt: report.generatedAt,
  };
}

function cellKey(abilityId: string, taskRole: string): string {
  return `${abilityId}:${taskRole}`;
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort() as T[];
}
