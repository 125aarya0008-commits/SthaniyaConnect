
(function () {
  "use strict";

  const DISTANCE_LIMIT_KM = 0.5;
  const TIME_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;

  function distanceKm(a, b) {
    const lat1 = Number(a.lat);
    const lng1 = Number(a.lng);
    const lat2 = Number(b.lat);
    const lng2 = Number(b.lng);

    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) {
      return Infinity;
    }

    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLng = (lng2 - lng1) * rad;

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * rad) *
      Math.cos(lat2 * rad) *
      Math.sin(dLng / 2) ** 2;

    return 6371 * 2 * Math.asin(
      Math.min(1, Math.sqrt(h))
    );
  }

  function timestamp(report) {
    const value = Number(report.ts);
    return Number.isFinite(value) ? value : NaN;
  }

  function isActive(report) {
    return report.status !== "resolved";
  }

  function areDuplicates(a, b) {
    if (!isActive(a) || !isActive(b)) return false;
    if (a.type !== b.type) return false;

    const ta = timestamp(a);
    const tb = timestamp(b);

    if (!Number.isFinite(ta) || !Number.isFinite(tb)) {
      return false;
    }

    return (
      Math.abs(ta - tb) <= TIME_LIMIT_MS &&
      distanceKm(a, b) <= DISTANCE_LIMIT_KM
    );
  }

  function detectDuplicateGroups(reports) {
    const active = reports.filter(isActive);
    const visited = new Set();
    const groups = [];

    for (let i = 0; i < active.length; i++) {
      if (visited.has(i)) continue;

      const queue = [i];
      const group = [];
      visited.add(i);

      while (queue.length) {
        const index = queue.shift();
        group.push(active[index]);

        for (let j = 0; j < active.length; j++) {
          if (visited.has(j)) continue;

          if (areDuplicates(active[index], active[j])) {
            visited.add(j);
            queue.push(j);
          }
        }
      }

      groups.push(group);
    }

    return groups;
  }

  function calculatePriority(report, duplicateCount, now = Date.now()) {
    if (report.status === "resolved") {
      return {
        score: 0,
        level: "Resolved",
        reasons: ["Complaint is resolved"]
      };
    }

    const severity = Math.min(
      5,
      Math.max(1, Number(report.severity) || 1)
    );

    const severityPoints = severity * 10;

    const ageDays = Math.max(
      0,
      (now - timestamp(report)) / 86400000 || 0
    );

    const agePoints = Math.min(20, Math.floor(ageDays * 2));
    const duplicatePoints = Math.min(
      25,
      Math.max(0, duplicateCount - 1) * 5
    );

    const statusPoints =
      report.status === "acknowledged" ? 0 : 5;

    const score = Math.min(
      100,
      severityPoints +
      agePoints +
      duplicatePoints +
      statusPoints
    );

    const level =
      score >= 75 ? "Critical" :
      score >= 50 ? "High" :
      score >= 25 ? "Medium" : "Low";

    return {
      score,
      level,
      reasons: [
        "Severity: " + severity + "/5",
        "Age: " + Math.floor(ageDays) + " days",
        "Related reports: " + duplicateCount,
        "Status: " + (report.status || "open")
      ]
    };
  }

  function analyzeReports(reports) {
    const groups = detectDuplicateGroups(reports);
    const countById = new Map();
    const groupById = new Map();

    groups.forEach((group, index) => {
      group.forEach(report => {
        countById.set(String(report.id), group.length);
        groupById.set(String(report.id), index + 1);
      });
    });

    return reports.map(report => {
      const duplicateCount =
        countById.get(String(report.id)) || 1;

      return {
        ...report,
        duplicateCount,
        duplicateGroup:
          groupById.get(String(report.id)) || null,
        priority: calculatePriority(report, duplicateCount)
      };
    }).sort((a, b) => b.priority.score - a.priority.score);
  }

  window.CivicIntelligence = {
    distanceKm,
    areDuplicates,
    detectDuplicateGroups,
    calculatePriority,
    analyzeReports
  };
})();
