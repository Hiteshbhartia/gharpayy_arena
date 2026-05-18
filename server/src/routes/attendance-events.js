import { crudRouter } from "../lib/crud.js";
import { AttendanceEvent } from "../models/index.js";

export default crudRouter(AttendanceEvent, {
  filterFields: ["employeeId", "kind"],
  sort: { ts: -1 },
});
