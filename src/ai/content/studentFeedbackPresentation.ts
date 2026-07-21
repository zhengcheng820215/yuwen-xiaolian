const INTERNAL_FEEDBACK_SUMMARY_PATTERN = /正式记录|受限反馈|人工标注|formal runtime|annotation/i;

export const DEFAULT_STUDENT_FEEDBACK_SUMMARY = '下面是根据本次回答整理的反馈。';

export function toStudentFeedbackSummary(summary?: string): string {
  const value = summary?.trim();
  if (!value || INTERNAL_FEEDBACK_SUMMARY_PATTERN.test(value)) {
    return DEFAULT_STUDENT_FEEDBACK_SUMMARY;
  }
  return value;
}
