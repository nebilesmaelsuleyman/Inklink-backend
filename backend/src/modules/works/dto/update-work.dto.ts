import { WorkStatus } from '../schema/work.schema';

export class UpdateWorkDto {
  title?: string;
  summary?: string;
  coverImage?: string;
  tags?: string[];
  status?: WorkStatus;
}
