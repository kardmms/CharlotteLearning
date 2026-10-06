import test from "node:test";
import assert from "node:assert/strict";
import { performanceAlerts, performanceAlertsFromMaterials } from "../src/lib/performance-trends.ts";

test("alerts only after a repeated scored trend", () => {
  const students = [{ id: "a", displayName: "A" }, { id: "b", displayName: "B" }];
  const recent = [
    [{ studentId: "a", score: 60 }, { studentId: "b", score: 95 }],
    [{ studentId: "a", score: 70 }, { studentId: "b", score: 95 }],
    [{ studentId: "a", score: 80 }, { studentId: "b", score: 95 }]
  ];
  assert.deepEqual(performanceAlerts(recent, students).map((alert) => alert.studentId), ["a"]);
  assert.deepEqual(performanceAlerts(recent.slice(0, 2), students), []);
});

test("uses each student's latest three scored assignments", () => {
  const students = [{ id: "a", displayName: "A" }, { id: "b", displayName: "B" }];
  const rows = [
    [{ studentId: "b", score: 90 }],
    [{ studentId: "a", score: 55 }, { studentId: "b", score: 90 }],
    [{ studentId: "a", score: 55 }, { studentId: "b", score: 90 }],
    [{ studentId: "a", score: 55 }, { studentId: "b", score: 90 }]
  ];
  assert.deepEqual(performanceAlerts(rows, students).map((alert) => alert.studentId), ["a"]);
});

test("notifies teachers when three scores stay low even without a class gap", () => {
  const students = [{ id: "a", displayName: "A" }];
  const rows = [48, 53, 51].map((score) => [{ studentId: "a", score }]);
  assert.match(performanceAlerts(rows, students)[0].message, /below 60%/);
});

test("ignores partial and ungraded sessions", () => {
  const date = new Date("2026-09-25");
  const materials: { sessions: { studentId: string; status: string; pointsEarned: number; signInAt: Date; completedAt: Date | null; answers: { isCorrect: boolean | null }[] }[] }[] = [60, 70, 80].map((score) => ({ sessions: [{
    studentId: "a", status: "COMPLETED", pointsEarned: score,
    signInAt: date, completedAt: date, answers: [{ isCorrect: true }]
  }] }));
  materials.unshift({ sessions: [{ studentId: "a", status: "PARTIAL", pointsEarned: 0, signInAt: date, completedAt: date, answers: [{ isCorrect: true }] }] });
  assert.equal(performanceAlertsFromMaterials(materials, [{ id: "a", displayName: "A" }]).length, 1);
  materials[1].sessions[0].answers = [{ isCorrect: null }];
  assert.equal(performanceAlertsFromMaterials(materials, [{ id: "a", displayName: "A" }]).length, 0);
});

test("waits for all written answers before using a score in notifications", () => {
  const date = new Date("2026-09-25");
  const materials = [50, 50, 50].map((score) => ({ sessions: [{
    studentId: "a", status: "COMPLETED", pointsEarned: score,
    signInAt: date, completedAt: date,
    answers: [{ isCorrect: true }, { isCorrect: null }]
  }] }));
  assert.deepEqual(performanceAlertsFromMaterials(materials, [{ id: "a", displayName: "A" }]), []);
});

import { comparePerformancePeriods } from '../src/lib/performance-trends.ts';
test('compares non-overlapping average scores with signed changes', () => {
  assert.equal(comparePerformancePeriods([90,80,70,70,60,50]).delta, 20);
  assert.equal(comparePerformancePeriods([50,60,70,70,80,90]).direction, 'down');
  assert.equal(comparePerformancePeriods([80,80,80,80,80,80]).delta, 0);
  assert.equal(comparePerformancePeriods([80,80,80,80,80,80]).direction, 'steady');
  assert.equal(comparePerformancePeriods([80.1,80,80,80,80,80]).direction, 'steady');
});
test('requires two full periods and never fabricates a trend for missing work', () => {
  assert.equal(comparePerformancePeriods([]).current, null);
  assert.equal(comparePerformancePeriods([90]).delta, null);
  assert.equal(comparePerformancePeriods([90,80,70,60,50]).direction, 'insufficient');
  assert.equal(comparePerformancePeriods([90,90,90,90,90,70,70,70,70,70],5).delta,20);
  assert.equal(comparePerformancePeriods([90,90,90,90,90,70],5).delta,null);
});
