import type { AnnouncementRecord, AssignmentRecord, CourseRecord } from "../core/types.js";
import { derivedField, realField } from "../core/types.js";
import { announcementStableId, assignmentStableId } from "../core/stableId.js";
import { todayInSchoolTimeZone } from "../core/schoolTime.js";
import { connectorOk } from "./types.js";
import type { ConnectorResult, LearningPlatformConnector } from "./types.js";

/**
 * Sanitized, fully synthetic fixture data — no real student's courses,
 * assignments, or grades. Lets Docket run end-to-end (onboarding through
 * Today view) with zero LearningSuite account, for development, screenshots,
 * and anyone evaluating the project before connecting their own account.
 * Deliberately spans unrelated departments so nothing here reads as one
 * specific student's actual schedule (docs/ARCHITECTURE.md §Generalization).
 */
export class DemoConnector implements LearningPlatformConnector {
  readonly id = "demo";
  readonly capabilities = ["courses", "assignments", "grades", "announcements", "schedule", "completionStatus"] as const;

  async getCourses(): Promise<ConnectorResult<CourseRecord[]>> {
    const now = new Date().toISOString();
    const courses: CourseRecord[] = DEMO_COURSES.map((c) => ({
      id: c.id,
      code: realField(c.code, "demo", now),
      title: realField(c.title, "demo", now),
      instructor: realField(c.instructor, "demo", now),
      term: realField(c.term, "demo", now),
    }));
    return connectorOk(courses);
  }

  async getAssignments(courseId: string): Promise<ConnectorResult<AssignmentRecord[]>> {
    const now = new Date().toISOString();
    const items = DEMO_ASSIGNMENTS.filter((a) => a.courseId === courseId).map((a): AssignmentRecord => ({
      id: assignmentStableId(courseId, a.localId),
      courseId,
      title: realField(a.title, "demo", now),
      type: realField(a.type, "demo", now),
      kind: derivedField(a.kind ?? "assignment", "demo", now),
      category: a.category ? realField(a.category, "demo", now) : undefined,
      description: a.description ? realField(a.description, "demo", now) : undefined,
      links: a.links ? realField(a.links, "demo", now) : undefined,
      dueDate: realField(a.dueDate, "demo", now),
      dueTime: a.dueTime ? realField(a.dueTime, "demo", now) : undefined,
      pointsPossible: a.pointsPossible !== undefined ? realField(a.pointsPossible, "demo", now) : undefined,
      pointsEarned: a.pointsEarned !== undefined ? realField(a.pointsEarned, "demo", now) : undefined,
      completionStatus: realField(a.completionStatus, "demo", now),
    }));
    return connectorOk(items);
  }

  async getAnnouncements(courseId: string): Promise<ConnectorResult<AnnouncementRecord[]>> {
    const now = new Date().toISOString();
    const items = DEMO_ANNOUNCEMENTS.filter((a) => a.courseId === courseId).map((a): AnnouncementRecord => ({
      id: announcementStableId(courseId, a.localId),
      courseId,
      title: realField(a.title, "demo", now),
      body: realField(a.body, "demo", now),
      postedDate: realField(a.postedDate, "demo", now),
    }));
    return connectorOk(items);
  }
}

const DEMO_COURSES = [
  { id: "demo-cs235", code: "CS 235", title: "Data Structures", instructor: "Prof. A. Rivera", term: "Fall 2026" },
  { id: "demo-math213", code: "MATH 213", title: "Calculus III", instructor: "Prof. K. Nguyen", term: "Fall 2026" },
  { id: "demo-wrtg316", code: "WRTG 316", title: "Technical Writing", instructor: "Prof. J. Okafor", term: "Fall 2026" },
  { id: "demo-physcs121", code: "PHYSCS 121", title: "Physics: Mechanics", instructor: "Prof. L. Bennett", term: "Fall 2026" },
];

function iso(daysFromNow: number): string {
  // Offsets from "today" in BYU's own timezone (src/core/schoolTime.ts), not the server's
  // — otherwise a demo item meant to be "due tomorrow" can silently land on the wrong
  // calendar day depending on what timezone the server happens to be running in.
  const [y, m, d] = todayInSchoolTimeZone().split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + daysFromNow));
  return date.toISOString().slice(0, 10);
}

const DEMO_ASSIGNMENTS = [
  {
    courseId: "demo-cs235",
    localId: "lab3",
    title: "Lab 3: Binary Search Trees",
    type: "lab",
    category: "Labs",
    description: "Implement insert, delete, and in-order traversal for a BST. Submit via the autograder link below.",
    links: [{ text: "Autograder", url: "https://autograder.example.edu/cs235/lab3" }],
    dueDate: iso(1),
    dueTime: "23:59",
    pointsPossible: 20,
    pointsEarned: undefined,
    completionStatus: "in_progress" as const,
  },
  { courseId: "demo-cs235", localId: "quiz2", title: "Quiz 2: Hash Tables", type: "quiz", category: "Quizzes", dueDate: iso(4), dueTime: "08:00", pointsPossible: 10, pointsEarned: 9, completionStatus: "completed" as const },
  { courseId: "demo-cs235", localId: "fallbreak", title: "Fall Break", type: "other", kind: "calendar_event" as const, dueDate: iso(10), dueTime: undefined, pointsPossible: undefined, pointsEarned: undefined, completionStatus: "not_started" as const },
  { courseId: "demo-math213", localId: "hw4", title: "Homework 4: Partial Derivatives", type: "homework", category: "Homework", dueDate: iso(1), dueTime: "23:59", pointsPossible: 25, pointsEarned: undefined, completionStatus: "not_started" as const },
  { courseId: "demo-math213", localId: "exam1", title: "Midterm Exam 1", type: "exam", category: "Exams", dueDate: iso(6), dueTime: undefined, pointsPossible: 100, pointsEarned: undefined, completionStatus: "not_started" as const },
  { courseId: "demo-wrtg316", localId: "reading5", title: "Reading: Chapter 5", type: "reading", dueDate: iso(3), dueTime: undefined, pointsPossible: 5, pointsEarned: undefined, completionStatus: "not_started" as const },
  { courseId: "demo-physcs121", localId: "quiz3", title: "Quiz 3: Kinematics", type: "quiz", dueDate: iso(2), dueTime: "10:00", pointsPossible: 10, pointsEarned: undefined, completionStatus: "not_started" as const },
  { courseId: "demo-physcs121", localId: "exam1", title: "Exam 1", type: "exam", dueDate: iso(6), dueTime: undefined, pointsPossible: 100, pointsEarned: undefined, completionStatus: "not_started" as const },
];

const DEMO_ANNOUNCEMENTS = [
  { courseId: "demo-cs235", localId: "ann1", title: "Lab 3 deadline extended", body: "Lab 3 is now due Friday instead of Wednesday.", postedDate: iso(-1) },
  { courseId: "demo-physcs121", localId: "ann1", title: "Exam 1 room change", body: "Exam 1 moves to the auditorium.", postedDate: iso(0) },
];
