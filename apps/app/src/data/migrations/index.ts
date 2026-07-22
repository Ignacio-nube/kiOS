import type { Migration } from "./types";
import { migration001 } from "./001_initial";

export const ALL_MIGRATIONS: Migration[] = [migration001];
