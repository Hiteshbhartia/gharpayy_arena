// server/src/config/defaultPermissionMatrix.js

// This matrix mirrors the launch‑mode ROLE_MATRIX but lives solely in the backend.
// It is used to repopulate the RolePermission collection when an admin
// clicks "Reset to Launch Defaults".

module.exports = {
  employee: [
    "home",
    "selfieAttendance",
    "dailyPulse",
    "flyBoard",
    "tasks",
    "operatorConsole",
    "kudos",
    "oneOnOnes",
  ],
  manager: [
    "home",
    "selfieAttendance",
    "dailyPulse",
    "flyBoard",
    "tasks",
    "operatorConsole",
    "liveRoster",
    "kpiGovernance",
    "kudos",
    "oneOnOnes",
    "workforce",
    "teamIntelligence",
    "leadershipActions",
  ],
  hr: [
    "home",
    "selfieAttendance",
    "dailyPulse",
    "flyBoard",
    "tasks",
    "operatorConsole",
    "liveRoster",
    "kpiGovernance",
    "kudos",
    "oneOnOnes",
    "workforce",
    "teamIntelligence",
    "leadershipActions",
    "hrCapabilities",
  ],
  admin: [
    "home",
    "liveRoster",
    "kpiGovernance",
    "kudos",
    "oneOnOnes",
    "workforce",
    "teamIntelligence",
    "leadershipActions",
    "adminFeatures",
    "adminPermissions",
  ],
};
