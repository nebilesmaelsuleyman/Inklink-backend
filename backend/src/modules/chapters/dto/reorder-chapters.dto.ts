export class ReorderChaptersDto {
  chapterIds?: string[];
  orders?: Array<{ id: string; orderIndex: number }>;
}
