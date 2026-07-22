export interface Migration {
  /** Consecutiva desde 1; el registro se valida al arrancar. */
  version: number;
  name: string;
  /** Statements DDL/DML; corren en una transacción junto al INSERT en schema_migrations. */
  statements: string[];
}
