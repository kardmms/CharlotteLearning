// Run against a local dev server only. Creates isolated fixtures and removes them in finally.
// PLAYWRIGHT_MODULE may point to the bundled Playwright package.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
process.loadEnvFile('.env.local');
if (!['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error('Browser fixtures require a local database.');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const prisma = new PrismaClient();
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const base = 'http://localhost:3100';
const suffix = Date.now();
const accountIds = [];
let school, teacher;
const failures = [];
async function check(name, fn) { try { await fn(); console.log(`PASS ${name}`); } catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.message}`); } }
async function cookie(context, role, data) {
  const secret = process.env.AUTH_SECRET || 'charlotte-dev-secret-change-before-production-32';
  const value = await new SignJWT({ role, ...data }).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
  await context.addCookies([{ name: `charlotte_${role}_session`, value, url: base }]);
}
try {
  school = await prisma.school.create({ data: { name:'Accessibility QA', slug:`accessibility-qa-${suffix}` } });
  teacher = await prisma.teacher.create({ data: { name:'QA Teacher', email:`qa-${suffix}@example.test`, passwordHash:'not-a-login', defaultSchoolId:school.id } });
  await prisma.schoolTeacher.create({data:{schoolId:school.id,teacherId:teacher.id,role:'OWNER'}});
  await mkdir('outputs/student-experience-qa',{recursive:true});
  for (const grade of ['3','6','9']) {
    const classroom = await prisma.classroom.create({data:{name:`English ${grade}`,gradeLevel:grade,schoolId:school.id,teacherId:teacher.id}});
    const account = await prisma.studentAccount.create({data:{displayName:'Avery QA',email:`qa-${grade}-${suffix}@example.test`,passwordHash:'not-a-login'}});
    accountIds.push(account.id);
    const student = await prisma.student.create({data:{schoolId:school.id,classroomId:classroom.id,accountId:account.id,displayName:'Avery QA'}});
    const makeMaterial = (title, activityKind = 'IN_CLASS') => prisma.material.create({data:{schoolId:school.id,teacherId:teacher.id,classroomId:classroom.id,gradeLevel:grade,title,status:'PUBLISHED',activityKind,questions:{create:[0,1].map(index=>({schoolId:school.id,type:'COMPREHENSION',prompt:`Question ${index + 1}: Why did the class compare the two plans?`,choicesJson:JSON.stringify(['To gather evidence','To guess']),correctAnswer:'To gather evidence',contextExcerpt:'The class read two plans. Each plan used evidence. They compared costs before choosing.',skillTag:'Evidence',sortOrder:index}))}},include:{questions:true}});
    const active = await makeMaterial('A shared decision');
    const practice = await makeMaterial('Practice questions','AT_HOME');
    const context = await browser.newContext({viewport:{width:1366,height:900}});
    await cookie(context,'student',{sub:account.id,studentId:student.id,classroomId:classroom.id,schoolId:school.id,name:student.displayName,email:account.email});
    // Deterministic browser speech adapter verifies sequencing; actual device audio is a manual check.
    await context.addInitScript(() => {
      window.__speech = {calls:[],active:null};
      class Utterance { constructor(text) {this.text=text;} }
      Object.defineProperty(window,'SpeechSynthesisUtterance',{value:Utterance});
      Object.defineProperty(window,'speechSynthesis',{value:{speak(u){window.__speech.calls.push(u.text);window.__speech.active=u;u.onstart?.();},cancel(){window.__speech.active=null;},pause(){},resume(){}}});
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/student');
    await check(`grade ${grade} overview`,async()=>{
      if (grade === '3') assert.equal(await page.getByRole('heading',{name:'What are you working on?'}).count(),1);
      else { await page.getByRole('heading',{name:'Assignments',exact:true}).waitFor(); assert.equal(await page.getByRole('heading',{name:'A shared decision'}).count(),1); }
      await page.screenshot({path:`outputs/student-experience-qa/grade-${grade}-overview.png`,fullPage:true});
    });
    if (grade !== '3') {
      await check(`grade ${grade} preview reading layout`,async()=>{
        await page.goto(base+`/student/station/${practice.id}`);
        await page.getByRole('heading',{name:/Question 1:/}).waitFor();
        await page.screenshot({path:`outputs/student-experience-qa/grade-${grade}-reading.png`,fullPage:true});
        assert.equal(await page.locator('.question-surface').evaluate(element=>getComputedStyle(element).display),'grid');
      });
      await page.goto(base+'/student/settings');
      await check(`grade ${grade} keyboard skip navigation`,async()=>{
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Skip to content');
        await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(()=>document.activeElement.id),'student-content');
      });
      await page.locator('summary').filter({hasText:'Reading & language'}).click();
      await page.getByLabel('Automatically read questions',{exact:true}).check();
      await page.getByLabel('Increase line spacing',{exact:true}).check();
      await page.getByLabel('Show reading passages in smaller sections',{exact:true}).check();
      await page.getByLabel('Text size',{exact:true}).selectOption('200');
      await page.locator('summary').filter({hasText:'Visual accessibility'}).click();
      await page.getByLabel('High contrast',{exact:true}).check();
      await page.locator('summary').filter({hasText:'Focus & attention'}).click();
      await page.getByLabel('Reduce motion and nonessential animations',{exact:true}).check();
      await page.getByLabel('Focus Mode — hide extra question decorations',{exact:true}).check();
      await page.getByLabel('Show a movable reading guide',{exact:true}).check();
      await page.getByText('Settings saved to your account.').waitFor();
      await check(`grade ${grade} persistence and combined options`,async()=>{
        await page.reload();
        await page.locator('.a11y-highContrast.a11y-focusMode.a11y-reducedMotion.a11y-textScaled').waitFor();
        const saved=await prisma.studentAccount.findUnique({where:{id:account.id}});
        assert.equal(saved.accessibilityPreferences.textSize,200);
        assert.equal(saved.accessibilityPreferences.autoRead,true);
      });
      await page.goto(base+`/student/station/${practice.id}`);
      await page.getByRole('heading',{name:/Question 1:/}).waitFor();
      await check(`grade ${grade} auto read, pause, resume, stop, replay`,async()=>{
        assert.ok((await page.evaluate(()=>window.__speech.calls)).some(text=>text.startsWith('Question 1:')));
        const question = page.locator('.read-aloud').filter({has:page.getByRole('heading',{name:/Question 1:/})});
        await question.getByRole('button',{name:'Pause',exact:true}).click();
        await question.getByRole('button',{name:'Resume',exact:true}).click();
        await question.getByRole('button',{name:'Stop',exact:true}).click();
        assert.equal(await page.evaluate(()=>window.__speech.active),null);
        await question.getByRole('button',{name:'Read aloud',exact:true}).click();
        await question.getByRole('button',{name:'Replay',exact:true}).click();
        assert.ok(await page.evaluate(()=>window.__speech.active.text.startsWith('Question 1:')));
      });
      await check(`grade ${grade} passage controls and mobile reflow`,async()=>{
        await page.getByRole('button',{name:'Next section',exact:true}).click();
        await page.getByText('Section 2 of 3',{exact:true}).waitFor();
        await page.getByLabel('Reading guide position',{exact:true}).fill('40');
        await page.setViewportSize({width:390,height:844});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth + 1),'horizontal overflow');
        await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
        await page.screenshot({path:`outputs/student-experience-qa/grade-${grade}-accessible-mobile.png`,fullPage:true});
      });
      await check(`grade ${grade} keyboard answer and next-question speech`,async()=>{
        const answer=page.getByRole('button',{name:'A To gather evidence',exact:true});
        await answer.focus(); await page.keyboard.press('Space');
        assert.equal(await answer.getAttribute('aria-pressed'),'true');
        const submit=page.getByRole('button',{name:/Submit answer/i});
        await submit.focus(); await page.keyboard.press('Enter');
        const next=page.getByRole('button',{name:/Next question|Continue/i}).last();
        await next.waitFor(); await next.click();
        await page.getByRole('heading',{name:/Question 2:/}).waitFor();
        assert.ok((await page.evaluate(()=>window.__speech.calls)).some(text=>text.startsWith('Question 2:')));
      });
      const room = await prisma.gameRoom.create({data:{schoolId:school.id,teacherId:teacher.id,classroomId:classroom.id,code:`${grade}${String(suffix).slice(-5)}`,status:'STARTING',vocabTerms:{create:['evidence','compare','resource','conserve'].map((word,index)=>({schoolId:school.id,word,definition:`The meaning of ${word}`,sortOrder:index}))}},include:{vocabTerms:true}});
      await check(`grade ${grade} vocabulary, flashcards, and live-game speech`,async()=>{
        await page.goto(base+`/student/practice/vocab/${room.id}`);
        await page.locator('.vocab-flashcard').waitFor();
        assert.equal(await page.locator('.vocab-flashcard-front').getAttribute('aria-hidden'),'false');
        await page.locator('.vocab-flashcard').focus(); await page.keyboard.press('Enter');
        assert.equal(await page.locator('.vocab-flashcard-back').getAttribute('aria-hidden'),'false');
        await page.goto(base+`/student/practice/vocab/${room.id}/solo`);
        await page.locator('.solo-vocab-question h2').waitFor();
        assert.ok((await page.evaluate(()=>window.__speech.calls)).some(text=>text.startsWith('The meaning of')));
        await page.locator('.vocab-choice-grid button').first().click();
        await page.getByRole('button',{name:'Next question',exact:true}).waitFor();
        await page.waitForTimeout(900);
        assert.equal(await page.getByRole('button',{name:'Next question',exact:true}).count(),1);
        await page.getByRole('button',{name:'Next question',exact:true}).click();
        const participant=await prisma.gameParticipant.create({data:{schoolId:school.id,roomId:room.id,studentId:student.id,displayName:student.displayName,questionOrderJson:JSON.stringify(room.vocabTerms.map(term=>term.id))}});
        await page.goto(base+`/student/games/vocab-dash/play/${participant.id}`);
        await page.locator('.vocab-question-panel h2').waitFor();
        assert.ok((await page.evaluate(()=>window.__speech.calls)).some(text=>text.startsWith('The meaning of')));
      });
      await check(`grade ${grade} reset accessibility`,async()=>{
        await page.goto(base+'/student/settings');
        await page.getByRole('button',{name:'Reset accessibility settings'}).click();
        await page.getByText('Settings saved to your account.').waitFor();
        await page.reload();
        assert.equal(await page.locator('.a11y-highContrast').count(),0);
        assert.equal(await page.getByLabel('Text size',{exact:true}).inputValue(),'100');
      });
      // Trend fixtures: rising, declining, steady, and no history.
      const learners=[student];
      for (const name of ['Declining QA','Steady QA','New QA']) learners.push(await prisma.student.create({data:{schoolId:school.id,classroomId:classroom.id,displayName:name}}));
      for(let i=0;i<6;i++) {
        const material=await makeMaterial(`Reading ${i+1}`);
        for(let n=0;n<3;n++) {
          const score=n===0?(i<3?90:60):n===1?(i<3?60:90):75;
          await prisma.studentSession.create({data:{schoolId:school.id,studentId:learners[n].id,materialId:material.id,status:'COMPLETED',pointsEarned:score,completedAt:new Date(Date.now()-i*86400000),answers:{create:material.questions.map(question=>({schoolId:school.id,questionId:question.id,answerText:'To gather evidence',isCorrect:true,pointsEarned:score/2}))}}});
        }
      }
      const teacherContext=await browser.newContext();
      await cookie(teacherContext,'teacher',{sub:teacher.id,name:teacher.name,email:teacher.email});
      const teacherPage=await teacherContext.newPage();
      await teacherPage.goto(base+`/teacher/classes/${classroom.id}/progress`);
      await check(`grade ${grade} teacher trend list and analytics`,async()=>{
        await teacherPage.getByRole('heading',{name:'Progress at a glance'}).waitFor();
        assert.equal(await teacherPage.getByText('↑ +30 pp',{exact:true}).count(),1);
        assert.equal(await teacherPage.getByText('↓ -30 pp',{exact:true}).count(),1);
        assert.equal(await teacherPage.getByText('→ 0 pp',{exact:true}).count(),1);
        assert.equal(await teacherPage.getByText('No scored work yet',{exact:true}).count(),1);
        await teacherPage.screenshot({path:`outputs/student-experience-qa/grade-${grade}-teacher.png`,fullPage:true});
        await teacherPage.locator('.watchlist-row').filter({hasText:'Avery QA'}).click();
        await teacherPage.getByRole('heading',{name:'Skills behind the trend'}).waitFor();
        assert.equal(await teacherPage.getByRole('rowheader',{name:'Evidence',exact:true}).count(),1);
      });
      await check(`grade ${grade} teacher comparison selector and phone layout`,async()=>{
        await teacherPage.goto(base+`/teacher/classes/${classroom.id}/progress`);
        await teacherPage.getByLabel('Comparison',{exact:true}).selectOption('5');
        await teacherPage.getByRole('button',{name:'Apply',exact:true}).click();
        await teacherPage.waitForURL(/period=5/);
        assert.equal(await teacherPage.getByText('More history needed',{exact:true}).count(),3);
        await teacherPage.setViewportSize({width:390,height:844});
        assert.ok(await teacherPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      });
      await check(`grade ${grade} results review`,async()=>{
        const result=await prisma.studentSession.findFirst({where:{studentId:student.id,status:'COMPLETED'},orderBy:{completedAt:'desc'}});
        await page.goto(base+`/student/results/${result.materialId}`);
        await page.getByRole('heading',{name:'Question review',exact:true}).waitFor();
        assert.equal(await page.getByRole('button',{name:'Read aloud',exact:true}).count(),2);
        assert.equal(await page.locator('.celebration-layer:visible').count(),0);
      });
      await teacherContext.close();
    }
    await check(`grade ${grade} no browser errors`,async()=>assert.deepEqual(errors,[]));
    await context.close();
  }
} finally {
  await browser.close();
  if (school) await prisma.school.delete({where:{id:school.id}});
  if (teacher) await prisma.teacher.delete({where:{id:teacher.id}});
  if(accountIds.length) await prisma.studentAccount.deleteMany({where:{id:{in:accountIds}}});
  await prisma.$disconnect();
}
if(failures.length) { console.error('Failed checks:',failures.join(', ')); process.exitCode=1; }
