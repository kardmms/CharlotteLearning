import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

if (process.env.PROVISION_EXPERIENCE_DEMO !== 'true') {
  console.log('Student experience demo provisioning skipped.');
  process.exit(0);
}
const teacherPassword = process.env.EXPERIENCE_DEMO_TEACHER_PASSWORD || '';
const studentPassword = process.env.EXPERIENCE_DEMO_STUDENT_PASSWORD || '';
const local = process.env.EXPERIENCE_DEMO_LOCAL_FIXTURE === 'true';
const host = new URL(process.env.DATABASE_URL).hostname;
const isLocal = ['localhost','127.0.0.1','::1'].includes(host);
if (teacherPassword.length < 16 || studentPassword.length < 16 || (local ? !isLocal : isLocal || process.env.VERCEL_ENV !== 'production' || process.env.DATABASE_ENVIRONMENT !== 'production')) {
  throw new Error('Demo provisioning requires strong passwords and an explicitly identified database.');
}
const teacherEmail = 'experience.teacher.20261006@example.test';
const studentEmail = 'experience.student.20261006@example.test';
const slug = 'student-experience-demo-20261006';
const passage = 'The student council compared two plans to reduce water waste at school. One plan added a new storage tank. The other repaired leaking pipes and placed reminders near sinks. The council recorded water use for one week before deciding. Repairing the pipes saved more water at a lower cost. The council chose repairs first and agreed to review the results after a month. The comparison showed why a decision should consider both evidence and practical costs.';
const questions = [
  ['What is the main idea of the passage?', ['Evidence helps people make practical decisions.','The school needs a larger parking lot.','Reminders always cost more than repairs.','The council ignored water use.'], 'Evidence helps people make practical decisions.', 'Main idea'],
  ['Which detail supports the council’s decision?', ['Pipe repairs saved more water at a lower cost.','The council met after lunch.','A storage tank is always best.','Water use was never measured.'], 'Pipe repairs saved more water at a lower cost.', 'Evidence'],
  ['Why did the council measure water use before deciding?', ['To collect evidence for comparing the plans.','To avoid discussing costs.','To delay every school activity.','To prove both plans were identical.'], 'To collect evidence for comparing the plans.', 'Inference'],
  ['What does “practical” mean in this passage?', ['Useful and realistic.','Impossible to measure.','Designed only for decoration.','Unrelated to the problem.'], 'Useful and realistic.', 'Vocabulary'],
  ['What happened before the council chose repairs?', ['The council compared water use and costs.','The council built a new tank.','The school stopped using sinks.','The council canceled the project.'], 'The council compared water use and costs.', 'Sequence'],
  ['Why will the council review the results after a month?', ['To check whether the chosen plan continues to work.','To remove all the repaired pipes.','To hide the cost of the plan.','To avoid collecting more evidence.'], 'To check whether the chosen plan continues to work.', 'Inference'],
  ['Which sentence summarizes the decision?', ['The council chose the plan with better measured results and lower costs.','The council chose the largest construction project.','The council made no comparison.','The council rejected every repair.'], 'The council chose the plan with better measured results and lower costs.', 'Summary'],
  ['Which two factors did the council compare?', ['Water savings and cost.','Book length and reading speed.','Lunch times and school colors.','Weather and parking spaces.'], 'Water savings and cost.', 'Comparison'],
  ['What caused the school to waste less water?', ['Repairing leaking pipes.','Leaving every tap running.','Removing the reminders.','Adding more leaks.'], 'Repairing leaking pipes.', 'Cause and effect'],
  ['Which action best follows the passage’s lesson?', ['Measure results before deciding which plan to use.','Choose the most expensive plan without checking it.','Ignore the effect of repairs.','Assume every plan has the same outcome.'], 'Measure results before deciding which plan to use.', 'Application'],
];
const prisma = new PrismaClient();
try {
  const teacherHash = await bcrypt.hash(teacherPassword,12);
  const studentHash = await bcrypt.hash(studentPassword,12);
  const result = await prisma.$transaction(async tx => {
    const existingTeacher = await tx.teacher.findUnique({where:{email:teacherEmail}});
    const existingStudent = await tx.studentAccount.findUnique({where:{email:studentEmail}});
    const existingSchool = await tx.school.findUnique({where:{slug}});
    if (existingTeacher || existingStudent || existingSchool) {
      if (!existingTeacher || !existingStudent || !existingSchool || existingTeacher.defaultSchoolId !== existingSchool.id || !(await bcrypt.compare(teacherPassword,existingTeacher.passwordHash)) || !(await bcrypt.compare(studentPassword,existingStudent.passwordHash))) throw new Error('Refusing to overwrite existing demo identities.');
      const classes = await tx.classroom.findMany({where:{schoolId:existingSchool.id,teacherId:existingTeacher.id},select:{id:true,name:true}});
      if(classes.length !== 2 || await tx.student.count({where:{schoolId:existingSchool.id,accountId:existingStudent.id}}) !== 2) throw new Error('Existing demo is incomplete; manual review required.');
      return {teacherEmail,studentEmail,classrooms:classes,reused:true};
    }
    const school = await tx.school.create({data:{name:'Charlotte Experience Demo — Sample Data',slug}});
    const teacher = await tx.teacher.create({data:{name:'Experience Demo Teacher',email:teacherEmail,passwordHash:teacherHash,defaultSchoolId:school.id,weeklySummaryEnabled:false}});
    await tx.schoolTeacher.create({data:{schoolId:school.id,teacherId:teacher.id,role:'OWNER'}});
    const account = await tx.studentAccount.create({data:{displayName:'Alex Rivera',email:studentEmail,passwordHash:studentHash}});
    const classrooms = [];
    for(const [grade,name] of [['7','Middle School · English 7'],['10','High School · English 10']]) {
      const classroom = await tx.classroom.create({data:{name,gradeLevel:grade,teacherId:teacher.id,schoolId:school.id,identityMode:'STANDARD'}});
      classrooms.push({id:classroom.id,name});
      const learners = [];
      for(const displayName of ['Alex Rivera','Jordan Lee','Sam Chen','Casey Morgan']) learners.push(await tx.student.create({data:{displayName,schoolId:school.id,classroomId:classroom.id,...(displayName === 'Alex Rivera' ? {accountId:account.id,email:studentEmail} : {})}}));
      async function material(title, activityKind = 'IN_CLASS', publishedAt = new Date()) {
        return tx.material.create({data:{schoolId:school.id,teacherId:teacher.id,classroomId:classroom.id,gradeLevel:grade,title,status:'PUBLISHED',activityKind,estimatedMinutes:20,createdAt:publishedAt,sourceName:'Original demo passage',sourceText:passage,sourcePreview:passage,questions:{create:questions.map(([prompt,choices,correctAnswer,skillTag],index)=>({schoolId:school.id,type:'COMPREHENSION',prompt,choicesJson:JSON.stringify(choices),correctAnswer,skillTag,contextExcerpt:passage,sortOrder:index+1,explanation:'Compare your answer with the details and measured results in the passage.'}))}},include:{questions:true}});
      }
      for(let i=0;i<6;i++) {
        const date = new Date(Date.now()-(i+1)*86400000);
        const assignment = await material(`Sample reading ${6-i} — completed history`,'IN_CLASS',date);
        const scores = [[90,80,80,60,70,60],[60,70,60,90,80,80],[70,70,70,70,70,70]];
        for(let n=0;n<3;n++) {
          const correctCount=scores[n][i]/10;
          await tx.studentSession.create({data:{schoolId:school.id,studentId:learners[n].id,materialId:assignment.id,status:'COMPLETED',signInAt:new Date(date.getTime()-10*60000),completedAt:date,signedOutAt:date,lastSeenAt:date,pointsEarned:scores[n][i],completedCharlotte:true,answers:{create:assignment.questions.map((question,index)=>({schoolId:school.id,questionId:question.id,answerText:index<correctCount?question.correctAnswer:JSON.parse(question.choicesJson)[1],isCorrect:index<correctCount,attemptCount:1,firstTryCorrect:index<correctCount,pointsEarned:index<correctCount?10:0,gradedAt:date}))}}});
        }
      }
      const ready = await material('Start here — A shared decision');
      // Keep completed history available to teachers, with only the new task open to students.
      await tx.material.updateMany({where:{classroomId:classroom.id,id:{not:ready.id},activityKind:'IN_CLASS'},data:{dueAt:new Date(Date.now()-3600000)}});
      await material('Extra practice — A shared decision','AT_HOME');
      let code;
      do {code=String(randomInt(100000,1000000));} while(await tx.gameRoom.findUnique({where:{code}}));
      await tx.gameRoom.create({data:{schoolId:school.id,teacherId:teacher.id,classroomId:classroom.id,code,vocabTerms:{create:[['evidence','Facts or details that support an idea.'],['compare','To examine how things are alike or different.'],['conserve','To use a resource carefully and avoid waste.'],['practical','Useful and realistic in a particular situation.'],['review','To examine something again.'],['resource','Something useful that people can use.']].map(([word,definition],sortOrder)=>({schoolId:school.id,word,definition,sortOrder}))}}});
    }
    // Current production has billing off; provision a real test license only if enabled later.
    if(process.env.SUBSCRIPTIONS_ENABLED === 'true') {
      await tx.teacherLicense.create({data:{teacherId:teacher.id,status:'active',seats:1}});
      await tx.studentLicense.create({data:{teacherId:teacher.id,accountId:account.id,active:true}});
    }
    return {teacherEmail,studentEmail,classrooms,reused:false};
  },{maxWait:10000,timeout:180000});
  console.log('Experience demo ready:',JSON.stringify(result));
} finally {await prisma.$disconnect();}
