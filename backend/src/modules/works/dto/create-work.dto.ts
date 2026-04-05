export class CreateWorkDto {
  authorId?: string;
  title!: string;
  summary?: string;
  coverImage?: string;
  tags?: string[];
}
