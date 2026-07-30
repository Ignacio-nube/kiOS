import type { Migration } from "./types";
import { migration001 } from "./001_initial";
import { migration002 } from "./002_cashiers_and_credit";
import { migration003 } from "./003_folded_search";

export const ALL_MIGRATIONS: Migration[] = [migration001, migration002, migration003];
