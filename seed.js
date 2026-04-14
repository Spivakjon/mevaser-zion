// Seed 80 realistic test members with families, events, duty, aliyot, announcements
// Run in browser console on the app page, then refresh
(function(){
var now=Date.now();
function uid(i){return (now+i)+'_'+Math.random().toString(36).slice(2,7)}
function gd(y,m,d){return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)]}
function pickN(arr,n){var s=arr.slice();var r=[];for(var i=0;i<n&&s.length;i++){var idx=Math.floor(Math.random()*s.length);r.push(s.splice(idx,1)[0])}return r}
function phone(){return '05'+Math.floor(Math.random()*10)+'-'+String(1000000+Math.floor(Math.random()*9000000))}

// ── Name pools (80+) ──
var firstNames=[
  'דוד','משה','אברהם','יצחק','יעקב','שמעון','ראובן','יהודה','בנימין','נתנאל',
  'אליהו','חיים','עמוס','גדעון','אורי','צבי','מנחם','ישראל','נועם','רפאל',
  'עמית','ארז','אסף','שלומי','יגאל','עופר','מאיר','ניסים','ברוך','עזרא',
  'אלעד','עידן','תומר','רועי','שחר','ליאור','אמיר','דביר','מתן','יואב',
  'אדם','דור','שי','טל','בר','יהונתן','עמיחי','נהוראי','רז','איתמר',
  'יונתן','אריאל','הראל','אלי','עדי','שגיא','אילן','אופיר','יניב','גלעד',
  'יאיר','בועז','שמואל','דניאל','אלחנן','נפתלי','אשר','זבולון','גד','לוי',
  'אליאב','יותם','אורן','עמוס','איתי','רון','ניר','סער','אביב','יובל'
];
var lastNames=[
  'כהן','לוי','מזרחי','פרץ','ביטון','אזולאי','דהן','אלון','שפירא','גולדשטיין',
  'סויסה','אבוטבול','ברק','רוזנברג','נחמיאס','הרשקוביץ','עמר','טל','קדוש','חדד',
  'אוחנה','בן דוד','גבאי','יוסף','חזן','שמש','אדרי','מלכה','סבג','עטיה',
  'אבירם','בן שמעון','גרינברג','דיין','הלל','ועקנין','זילברמן','חורי','טויטו','ידיד',
  'כספי','לביא','מרציאנו','נגר','סלומון','עבדי','פדידה','צדוק','קמחי','רביב',
  'שמעוני','תורג׳מן','אטיאס','בוזגלו','גנון','דרעי','הדר','וייס','זוהר','חממי',
  'טבול','יפרח','כרמלי','לוגסי','מדמוני','נאמן','סבאג','עמרם','פינטו','צרפתי',
  'קורן','רחמים','שטרית','תמם','אליאס','בדוש','גורן','דוידוב','הלוי','ובר'
];
var fatherNames=[
  'אברהם','יצחק','יעקב','משה','אהרן','שלמה','דניאל','יוסף','אליעזר','מאיר',
  'נחום','שמואל','בנימין','גרשון','עזרא','חיים','נתן','ברוך','צבי','מרדכי',
  'רפאל','ישעיהו','עמוס','שאול','יחזקאל','אלי','חנוך','עובדיה','זכריה','פנחס',
  'מנשה','אפרים','אורי','תומר','ניסן','רחמים','סלמן','כליפה','מסעוד','שלום',
  'דוד','אליהו','יהודה','שמעון','ראובן','גדליה','עקיבא','הלל','בצלאל','ירמיהו',
  'עמרם','קרניאל','ליאור','נתנאל','שילה','יוסי','אשר','נפתלי','גד','זבולון',
  'חגי','מלאכי','יואל','יונה','עמוס','מיכה','נחמיה','שריה','עדיאל','ישי'
];
var motherNames=[
  'שרה','רבקה','רחל','לאה','מרים','חנה','אסתר','דבורה','ציפורה','בתיה',
  'יוכבד','נעמי','רות','תמר','דינה','עדנה','שושנה','חיה','גילה','מיכל',
  'אביגיל','יעל','עתליה','צפורה','שולמית','ברכה','טובה','פנינה','קציעה','עליזה',
  'חדוה','מזל','סעדה','פריחה','דליה','אילנה','שירה','נורית','ורד','רינה',
  'לילך','כרמלה','מרגלית','סימה','עפרה','פירוזה','צמרת','רחמה','שגית','תקווה',
  'אורה','בלהה','גאולה','דבש','הדס','ויקטוריה','זהרה','חמדה','טהרה','ימימה',
  'כלילה','לבנה','מוריה','נחמה','סגולה','עלומה','פעמית','צביה','קהילה','רננה'
];
var spouseNames=[
  'שרה','רחל','לאה','מרים','אסתר','דינה','חנה','רבקה','תמר','יעל',
  'שושנה','נעמי','עדנה','מיכל','אורלי','חיה','ציפי','גילה','ענת','דפנה',
  'מורית','הגר','שירלי','אורית','ליאורה','אילנה','סיגל','יפה','בתיה','נורית',
  'רונית','טלי','עירית','אפרת','גליה','הדר','ורדה','זיוה','חגית','טובית',
  'ימית','כרמית','לימור','מיטל','נגה','סתוית','עינת','פזית','ציפורית','קרנית',
  'רויטל','שלומית','תהילה','אורנית','בילהה','גליה','דליה','הדסה','ורדית','זהרית',
  'חנית','טובה','ירדנה','כלנית','לילך','מרגנית','נריה','סאלית','ענבל','פנינית',
  'צופית','קטיפה','רעות','שקמה','תירצה','אביטל','בת שבע','גאולה','דורית','הילה'
];
var boyNames=[
  'איתן','עידו','יונתן','אריאל','נועם','אלעד','עומר','תומר','רועי','גיל',
  'אסף','ניר','שחר','ליאור','אמיר','דביר','אייל','עידן','מתן','יואב',
  'אדם','דור','שי','טל','בר','יהונתן','עמיחי','אלישיב','נהוראי','רז',
  'אופיר','הראל','ינון','מעיין','צוף','קורן','שגב','אביאל','גולן','הלל',
  'זיו','חיליק','טוהר','ישי','כפיר','ליאם','מיכאל','נדב','סהר','פלא'
];
var girlNames=[
  'נועה','שירה','מאיה','תמר','יעל','ליאור','אורי','הדר','רוני','דנה',
  'עדי','אלה','שקד','ים','אגם','ליהי','רותם','מורן','קרן','גלי',
  'נטע','שיראל','ענבר','תהילה','הילה','עינב','טליה','אביגיל','חן','עלמה',
  'אמונה','ברקת','גפן','דקלה','הדס','ורד','זהבית','חמנית','טופז','ירין',
  'כרמל','לוטם','מעיין','נגה','סופיה','עדן','פרי','צופיה','קשת','רננה'
];
var deceasedNames=[
  'שלמה','אברהם','יצחק','יעקב','משה','אהרן','שמואל','דניאל','יוסף','נחום',
  'מאיר','חיים','ברוך','עזרא','גרשון','צבי','נתן','אליעזר','מרדכי','בנימין',
  'שרה','רבקה','לאה','רחל','מרים','חנה','אסתר','דבורה','ציפורה','בתיה',
  'סימה','מזל','עליזה','פריחה','כמוס','מסעוד','שלום','סעדיה','עזיזה','רחמה'
];
var streets=[
  'הצופים','האלון','הברוש','הדקל','הזית','התמר','האורן','השקד','הרימון','הגפן',
  'התאנה','הערבה','השיטה','האתרוג','הלוטם','הנרקיס','החרצית','היסמין','הכלנית','הרקפת',
  'הדגנית','הנורית','הסחלב','העירית','הפרג','הצבעוני','הקחוון','הרותם','השושן','הסביון'
];
var cities=['תל מונד','מבשרת ציון','בית שמש','מודיעין','ירושלים','אלעד','פתח תקווה','בני ברק','רעננה','כפר סבא'];
var volTypes=['קניות לקידוש','סידור קידוש','דבר תורה','ועד חסד','הכנת בית כנסת','חזנות','בעל קורא','גבאות'];
var tags=['גבאי','חזן','בעל קורא','ועד','מתנדב קבוע','חבר ועד','אחראי קידוש','שמש'];

// ── Parashot for bar mitzvahs (Shabbatot in upcoming months) ──
var bmParashot=[
  {parasha:'אמור',    barDate:'2026-05-09'},
  {parasha:'בהר',     barDate:'2026-05-16'},
  {parasha:'במדבר',   barDate:'2026-05-30'},
  {parasha:'נשא',     barDate:'2026-06-06'},
  {parasha:'בהעלותך', barDate:'2026-06-13'},
  {parasha:'שלח',     barDate:'2026-06-20'},
  {parasha:'קורח',    barDate:'2026-06-27'},
  {parasha:'פינחס',   barDate:'2026-07-11'},
  {parasha:'מטות',    barDate:'2026-07-18'},
  {parasha:'מסעי',    barDate:'2026-07-25'},
  {parasha:'דברים',   barDate:'2026-08-01'},
  {parasha:'ואתחנן',  barDate:'2026-08-08'},
  {parasha:'עקב',     barDate:'2026-08-15'},
  {parasha:'ראה',     barDate:'2026-08-22'},
  {parasha:'שופטים',  barDate:'2026-08-29'},
  {parasha:'כי תצא',  barDate:'2026-09-05'}
];

// ── Yahrzeit dates across many Hebrew months ──
var nearYahrzeits=[
  {hd:'20',hm:'1',hy:'5745'},   // 20 Nisan
  {hd:'25',hm:'1',hy:'5752'},   // 25 Nisan
  {hd:'2',hm:'2',hy:'5760'},    // 2 Iyar
  {hd:'5',hm:'2',hy:'5748'},    // 5 Iyar
  {hd:'10',hm:'2',hy:'5755'},   // 10 Iyar
  {hd:'15',hm:'2',hy:'5763'},   // 15 Iyar
  {hd:'20',hm:'2',hy:'5740'},   // 20 Iyar
  {hd:'28',hm:'2',hy:'5758'},   // 28 Iyar
  {hd:'3',hm:'3',hy:'5749'},    // 3 Sivan
  {hd:'8',hm:'3',hy:'5765'},    // 8 Sivan
  {hd:'12',hm:'3',hy:'5742'},   // 12 Sivan
  {hd:'18',hm:'3',hy:'5756'},   // 18 Sivan
  {hd:'1',hm:'4',hy:'5751'},    // 1 Tammuz
  {hd:'7',hm:'4',hy:'5744'},    // 7 Tammuz
  {hd:'14',hm:'4',hy:'5762'},   // 14 Tammuz
  {hd:'21',hm:'4',hy:'5738'},   // 21 Tammuz
  {hd:'3',hm:'5',hy:'5753'},    // 3 Av
  {hd:'15',hm:'5',hy:'5767'},   // 15 Av
  {hd:'22',hm:'5',hy:'5746'},   // 22 Av
  {hd:'5',hm:'6',hy:'5759'}     // 5 Elul
];

// ── Child distribution: 65 married, 15 single ──
// Married families get 2-6 children, singles get 0
var childCounts=[];
for(var ci=0;ci<65;ci++) childCounts.push(2+Math.floor(Math.random()*5)); // 2-6 kids
for(var ci=0;ci<15;ci++) childCounts.push(0); // singles

// Bar mitzvah families: 16 families with BM candidates
var bmFamilies=[0,2,4,7,10,13,16,19,22,25,30,35,40,45,50,55];

// ── Generate 80 members ──
var members=[];
for(var i=0;i<80;i++){
  var isMarried=i<65;
  var fn=firstNames[i%firstNames.length];
  var ln=lastNames[i%lastNames.length];
  var fa=fatherNames[i%fatherNames.length];
  var mo=motherNames[i%motherNames.length];

  // Avoid duplicate names by appending suffix for second cycle
  if(i>=firstNames.length) fn=firstNames[(i+7)%firstNames.length];

  var m={
    firstName:fn,
    lastName:ln,
    fatherName:fa,
    motherName:mo,
    torahName:fn+' בן '+fa,
    phone:phone(),
    email:fn.replace(/\s/g,'')+'_'+ln.replace(/\s/g,'')+'@example.com',
    idNumber:Math.random()>0.3?String(100000000+Math.floor(Math.random()*899999999)):'',
    birthDate:gd(1960+Math.floor(Math.random()*35),1+Math.floor(Math.random()*12),1+Math.floor(Math.random()*28)),
    address:'רחוב '+pick(streets)+' '+Math.floor(1+Math.random()*120)+', '+pick(cities),
    parasha:'',
    readP:'',
    readH:'',
    spouse:null,
    children:[],
    yahrzeits:[],
    volunteering:pickN(volTypes,1+Math.floor(Math.random()*3)),
    customTags:i<8?[tags[i%tags.length]]:(Math.random()>0.7?pickN(tags,1+Math.floor(Math.random()*2)):[]),
    dutyRoster:isMarried&&i<50,
    membershipPaid:Math.random()>0.2,
    membershipPaidDate:Math.random()>0.4?gd(2026,1+Math.floor(Math.random()*4),1+Math.floor(Math.random()*28)):'',
    notes:Math.random()>0.7?pick(['מעוניין בשיעור תורה','חדש בקהילה','צריך עזרה בהסעות','מתנדב קבוע לקידוש','בעל ניסיון בחזנות','רוצה לקרוא בתורה','עולה חדש','חבר ועד ותיק']):'',
    timestamp:new Date(Date.now()-Math.floor(Math.random()*90*86400000)).toISOString()
  };

  // Member-level bar mitzvah parasha (adult who had theirs)
  if(i%5===0){
    var adultParashot=['בראשית','וירא','חיי שרה','תולדות','ויצא','וישלח','וישב','מקץ','ויגש','ויחי',
      'שמות','וארא','בא','בשלח','יתרו','משפטים'];
    m.parasha=adultParashot[Math.floor(i/5)%adultParashot.length];
    m.readP=Math.random()>0.4?'כן':'לא';
    m.readH=Math.random()>0.4?'כן':'לא';
  }

  // Spouse
  if(isMarried){
    m.spouse={
      name:spouseNames[i%spouseNames.length],
      phone:phone(),
      email:Math.random()>0.5?spouseNames[i%spouseNames.length].replace(/\s/g,'')+'_'+ln.replace(/\s/g,'')+'@example.com':'',
      birthDate:gd(1965+Math.floor(Math.random()*30),1+Math.floor(Math.random()*12),1+Math.floor(Math.random()*28))
    };
  }

  // Children
  var nc=childCounts[i];
  var bmIdx=bmFamilies.indexOf(i);
  var hasBM=bmIdx>=0;
  for(var c=0;c<nc;c++){
    var isBoy=Math.random()>0.45;
    var pool=isBoy?boyNames:girlNames;
    var cname=pick(pool);
    var child;

    if(hasBM&&c===0){
      // Bar/bat mitzvah candidate — child born ~12-13 years ago, with upcoming date
      var bmInfo=bmParashot[bmIdx%bmParashot.length];
      var bmAge=isBoy?13:12;
      var birthHY=5786-bmAge;
      child={
        name:cname,
        gender:isBoy?'זכר':'נקבה',
        hd:String(5+Math.floor(Math.random()*20)),
        hm:String(1+Math.floor(Math.random()*6)),
        hy:String(birthHY),
        gd:gd(birthHY-3760,3+Math.floor(Math.random()*6),5+Math.floor(Math.random()*23)),
        mode:'heb',
        wantsBM:true,
        barDate:bmInfo.barDate,
        parasha:bmInfo.parasha,
        readP:Math.random()>0.3?'כן':'',
        readH:Math.random()>0.5?'כן':''
      };
    } else {
      // Regular child — various ages
      var birthYear=2005+Math.floor(Math.random()*20); // ages 1-21
      child={
        name:cname,
        gender:isBoy?'זכר':'נקבה',
        hd:String(1+Math.floor(Math.random()*28)),
        hm:String(1+Math.floor(Math.random()*12)),
        hy:String(birthYear+3760),
        gd:gd(birthYear,1+Math.floor(Math.random()*12),1+Math.floor(Math.random()*28)),
        mode:'heb',
        wantsBM:false,
        barDate:'',
        parasha:'',
        readP:'',
        readH:''
      };
    }
    m.children.push(child);
  }

  // Yahrzeits — 1-3 per family
  var numYrz=1+Math.floor(Math.random()*3);
  for(var y=0;y<numYrz;y++){
    var decIdx=(i*3+y)%deceasedNames.length;
    var yr;
    if(i<10&&y===0){
      // Near yahrzeit for first 10 members (will show in week card)
      yr=nearYahrzeits[i];
      yr={
        name:deceasedNames[decIdx]+' '+ln,
        hd:yr.hd,
        hm:yr.hm,
        hy:yr.hy,
        gd:'',
        mode:'heb',
        lead:i<5?'כן':'',
        haft:i<3?'כן':''
      };
    } else {
      yr={
        name:deceasedNames[(decIdx+y*7)%deceasedNames.length]+' '+ln,
        hd:String(1+Math.floor(Math.random()*28)),
        hm:String(1+Math.floor(Math.random()*12)),
        hy:String(5730+Math.floor(Math.random()*50)),
        gd:'',
        mode:'heb',
        lead:Math.random()>0.7?'כן':'',
        haft:Math.random()>0.8?'כן':''
      };
    }
    m.yahrzeits.push(yr);
  }

  members.push(m);
}

// Assign IDs
for(var k=0;k<members.length;k++){
  members[k].id=uid(k);
}

// ── Save members ──
localStorage.setItem('mbz_v5',JSON.stringify(members));

// ── Set up duty queue (first 50 members with dutyRoster=true) ──
var dutyIds=members.filter(function(m){return m.dutyRoster}).map(function(m){return m.id});
// Shuffle for random rotation
for(var si=dutyIds.length-1;si>0;si--){var sj=Math.floor(Math.random()*(si+1));var tmp=dutyIds[si];dutyIds[si]=dutyIds[sj];dutyIds[sj]=tmp}
localStorage.setItem('mbz_duty_queue',JSON.stringify(dutyIds));
localStorage.setItem('mbz_duty_history',JSON.stringify({}));
localStorage.setItem('mbz_duty_swaps',JSON.stringify({}));

// ── Set up aliyot for this Shabbat ──
var shabbat=new Date();var dow=shabbat.getDay();if(dow!==6)shabbat.setDate(shabbat.getDate()+(6-dow));
var shKey=shabbat.getFullYear()+'-'+String(shabbat.getMonth()+1).padStart(2,'0')+'-'+String(shabbat.getDate()).padStart(2,'0');
var aliyotNames=pickN(members.slice(0,40),7);
var aliyotSlots={};
var slotNames=['כהן','לוי','שלישי','רביעי','חמישי','שישי','שביעי'];
for(var ai=0;ai<7;ai++){
  aliyotSlots[slotNames[ai]]=aliyotNames[ai].firstName+' '+aliyotNames[ai].lastName;
}
localStorage.setItem('mbz_aliyot',JSON.stringify({date:shKey,slots:aliyotSlots}));

// ── Set up maftir & haftarah ──
var maftirMember=members[Math.floor(Math.random()*40)];
aliyotSlots['מפטיר']=maftirMember.firstName+' '+maftirMember.lastName;
localStorage.setItem('mbz_aliyot',JSON.stringify({date:shKey,slots:aliyotSlots}));

// ── Set up kiddush for this Shabbat ──
var kiddushMember=members[Math.floor(Math.random()*40)];
localStorage.setItem('mbz_kiddush',JSON.stringify({
  date:shKey,
  who:kiddushMember.firstName+' '+kiddushMember.lastName,
  notes:'לרגל יום הולדת'
}));

// ── Set up announcements (more variety) ──
var announcements=[
  {title:'שיעור תורה שבועי',body:'בכל יום שלישי בשעה 20:30 שיעור בפרשת השבוע עם הרב גולדשטיין. כולם מוזמנים!',timestamp:new Date(Date.now()-86400000*5).toISOString()},
  {title:'קידוש מיוחד השבת',body:'השבת קידוש מוגדל לרגל בר המצווה. נא להגיע בזמן לתפילה.',timestamp:new Date(Date.now()-86400000*3).toISOString()},
  {title:'אסיפת חברים',body:'אסיפת חברים שנתית תתקיים ביום רביעי הקרוב בשעה 21:00 בבית הכנסת. נושאים: תקציב שנתי, בחירת ועד, שיפוצים.',timestamp:new Date(Date.now()-86400000*2).toISOString()},
  {title:'שיפוץ בית הכנסת',body:'בעז"ה נתחיל בשיפוץ חדר הכניסה. מתנדבים מוזמנים ליצור קשר עם הגבאי.',timestamp:new Date(Date.now()-86400000).toISOString()},
  {title:'סדר פסח קהילתי',body:'הקהילה מארגנת סדר פסח משותף לבודדים ולחיילים. הרשמה אצל הגבאי עד יום שלישי.',timestamp:new Date().toISOString()},
  {title:'הרצאה בנושא חינוך',body:'הרב דוד שפירא מעביר הרצאה בנושא "חינוך ילדים בעולם דיגיטלי". מוצ"ש בשעה 21:00.',timestamp:new Date(Date.now()+86400000).toISOString()}
];
localStorage.setItem('mbz_announcements',JSON.stringify(announcements));

// ── Set up membership settings ──
localStorage.setItem('mbz_membership',JSON.stringify({year:2026,link:'https://pay.example.com/mbz'}));

// ── Volunteering types & tags ──
localStorage.setItem('mbz_vol_types',JSON.stringify(volTypes));
localStorage.setItem('mbz_custom_tags',JSON.stringify(tags));

// ── Clear week card cache so new data shows ──
localStorage.removeItem('mbz_wk_cache');

// ── Sync to Sheets if available ──
if(typeof SHEETS_URL!=='undefined'&&SHEETS_URL){
  console.log('🔄 מסנכרן ל-Sheets...');
  members.forEach(function(m,idx){
    setTimeout(function(){
      sheetsPost({action:'save',member:m}).catch(function(e){console.warn('sync err',e)});
    },idx*100); // stagger requests
  });
}

// ── Summary ──
var bmCount=members.reduce(function(sum,m){return sum+m.children.filter(function(c){return c.wantsBM}).length},0);
var totalKids=members.reduce(function(sum,m){return sum+m.children.length},0);
var totalYrz=members.reduce(function(sum,m){return sum+m.yahrzeits.length},0);
var dutyCount=members.filter(function(m){return m.dutyRoster}).length;
var paidCount=members.filter(function(m){return m.membershipPaid}).length;
var marriedCount=members.filter(function(m){return m.spouse}).length;
var taggedCount=members.filter(function(m){return m.customTags&&m.customTags.length}).length;
var withNotes=members.filter(function(m){return m.notes}).length;

var summary=[
  '✅ נוצרו '+members.length+' מתפללים!',
  '💑 '+marriedCount+' נשואים עם בנות זוג',
  '👨‍👧‍👦 '+totalKids+' ילדים ('+bmCount+' בר/בת מצווה קרובים)',
  '🕯 '+totalYrz+' יארצייטים ('+nearYahrzeits.length+' בתאריכים קרובים)',
  '📋 '+dutyCount+' ברשימת תורנויות',
  '💳 '+paidCount+'/'+members.length+' שילמו דמי חבר',
  '🏷 '+taggedCount+' עם תגיות',
  '📝 '+withNotes+' עם הערות',
  '📜 8 עליות מוקצות לשבת הקרובה (כולל מפטיר)',
  '🍷 קידוש מוגדר: '+kiddushMember.firstName+' '+kiddushMember.lastName,
  '📢 '+announcements.length+' הודעות ציבוריות',
  '',
  '🔄 רענן את הדף לראות הכל!'
].join('\n');

console.log(summary);
alert(summary);
})();
