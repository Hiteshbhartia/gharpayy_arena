// Simple test harness for auth-helpers
import { getManagerHierarchyIds, canAccessEmployeeResource, logSecurityAudit, isAdmin, isHR, isManager } from './server/src/lib/auth-helpers.js';
import { Employee } from './server/src/models/index.js';

async function run() {
  // Mock request
  const req = { user: { id: 'u1', email: 'admin@example.com', role: 'admin', employeeId: 'e1' }, method: 'GET', originalUrl: '/api/test' };
  logSecurityAudit(req, 'TEST_ACTION', { foo: 'bar' });
  console.log('isAdmin', isAdmin(req.user));
  console.log('isHR', isHR(req.user));
  console.log('isManager', isManager(req.user));
  // Assuming Employee collection has data, but we just call function (will query DB). Use try/catch.
  try {
    const ids = await getManagerHierarchyIds('e2');
    console.log('Hierarchy IDs for e2', ids);
    const canAccess = await canAccessEmployeeResource(req.user, 'e3');
    console.log('canAccess e3', canAccess);
  } catch (e) { console.error('DB error (expected in test env)', e.message); }
}
run();
