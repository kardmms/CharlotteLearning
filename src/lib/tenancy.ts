import "server-only";

import crypto from "node:crypto";
import { Prisma, SchoolRole } from "@prisma/client";
import { prisma } from "@/lib/db";

type TeacherForSchool = {
  id: string;
  name: string;
  email: string;
  isShowcase?: boolean;
  defaultSchoolId?: string | null;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

export type DefaultSchoolOptions = {
  name?: string | null;
  districtName?: string | null;
  officialDirectoryId?: string | null;
  role?: SchoolRole;
};

function schoolNameForTeacher(teacher: TeacherForSchool) {
  return teacher.isShowcase ? "Showcase Workspace" : `${teacher.name} School Workspace`;
}

function schoolSlugForTeacher(teacher: TeacherForSchool) {
  const hash = crypto
    .createHash("sha256")
    .update(`${teacher.id}:${teacher.email}`)
    .digest("hex")
    .slice(0, 16);
  return `teacher-${hash}`;
}

export async function createDefaultSchoolForTeacher(
  db: DbClient,
  teacher: TeacherForSchool,
  options: DefaultSchoolOptions = {}
) {
  const slug = schoolSlugForTeacher(teacher);
  const name = options.name?.trim() || schoolNameForTeacher(teacher);
  const districtName = options.districtName?.trim() || null;
  const school = await db.school.upsert({
    where: { slug },
    create: {
      name,
      slug,
      districtName,
      officialDirectoryId: options.officialDirectoryId || null
    },
    update: {
      name,
      districtName,
      officialDirectoryId: options.officialDirectoryId || null
    },
    select: {
      id: true,
      name: true,
      slug: true
    }
  });
  await db.schoolTeacher.upsert({
    where: {
      schoolId_teacherId: {
        schoolId: school.id,
        teacherId: teacher.id
      }
    },
    create: {
      schoolId: school.id,
      teacherId: teacher.id,
      role: options.role || SchoolRole.OWNER
    },
    update: {}
  });
  await db.teacher.update({
    where: { id: teacher.id },
    data: { defaultSchoolId: school.id }
  });
  return school;
}

export async function ensureTeacherSchool(teacher: TeacherForSchool) {
  const preferred = teacher.defaultSchoolId
    ? await prisma.schoolTeacher.findFirst({
        where: { teacherId: teacher.id, schoolId: teacher.defaultSchoolId },
        include: { school: true }
      })
    : null;
  if (preferred) {
    return {
      schoolId: preferred.schoolId,
      schoolRole: preferred.role,
      schoolName: preferred.school.name,
      schoolSlug: preferred.school.slug
    };
  }

  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.schoolTeacher.findFirst({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "asc" },
      include: { school: true }
    });
    if (existing) {
      if (!teacher.defaultSchoolId) {
        await transaction.teacher.update({
          where: { id: teacher.id },
          data: { defaultSchoolId: existing.schoolId }
        });
      }
      return {
        schoolId: existing.schoolId,
        schoolRole: existing.role,
        schoolName: existing.school.name,
        schoolSlug: existing.school.slug
      };
    }

    const school = await createDefaultSchoolForTeacher(transaction, teacher);
    return {
      schoolId: school.id,
      schoolRole: SchoolRole.OWNER,
      schoolName: school.name,
      schoolSlug: school.slug
    };
  });
}
