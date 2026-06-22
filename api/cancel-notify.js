const FB_KEY = 'AIzaSyAwYQq-ddQT8fBFytQYF5bgY5geL3SM2Ew';
const FB_PROJECT = 'botclinica-60b6f';
const BASE = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`;
const EVOLUTION_URL = 'https://evolution-api-production-16f18.up.railway.app';
const EVOLUTION_KEY = 'botclinica2025';
const INSTANCE = 'botclinica';

function parseTimeM(s){const[h,m]=s.split(':');return+h*60+ +m;}
function formatTimeM(m){return`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;}

async function fbGet(path){
  const r=await fetch(`${BASE}/${path}?key=${FB_KEY}`);
  return r.json();
}
async function fbPatch(path,body){
  await fetch(`${BASE}/${path}?key=${FB_KEY}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
}

function generateSlots(doc, date){
  if(!doc.schedStart||!doc.schedEnd||!doc.schedDays?.length)return[];
  const dow=new Date(date+'T12:00:00').getDay();
  if(!doc.schedDays.includes(dow))return[];
  const dur=doc.schedDuration||30;
  const end=parseTimeM(doc.schedEnd);
  const ls=doc.schedLunchStart?parseTimeM(doc.schedLunchStart):null;
  const le=doc.schedLunchEnd?parseTimeM(doc.schedLunchEnd):null;
  let cur=parseTimeM(doc.schedStart);
  const slots=[];
  while(cur+dur<=end){
    if(ls&&le&&cur>=ls&&cur<le){cur=le;continue;}
    slots.push(formatTimeM(cur));cur+=dur;
  }
  return slots;
}

export default async function handler(req, res) {
  if(req.method!=='POST') return res.status(405).end();

  const {aptId, clinicUid} = req.body;
  const uid = clinicUid || 'fMi67Aq1QzfM9Xhnj7eH2vJBTe92';

  try {
    // 1. Get appointment details
    const aptData = await fbGet(`clinicas/${uid}/agendamentos/${aptId}`);
    if(!aptData.fields) return res.status(404).json({error:'Consulta não encontrada'});

    const f = aptData.fields;
    const patientPhone = (f.patientPhone?.stringValue||'').replace('+','');
    const patientName = f.patientName?.stringValue||'Paciente';
    const docId = f.docId?.stringValue||'';
    const docName = f.docName?.stringValue||'médico(a)';
    const date = f.date?.stringValue||'';
    const time = f.time?.stringValue||'';

    // 2. Cancel in Firebase
    await fbPatch(`clinicas/${uid}/agendamentos/${aptId}`,{
      fields:{status:{stringValue:'cancelled'},cancelledAt:{stringValue:new Date().toISOString()}}
    });

    if(!patientPhone) return res.status(200).json({cancelled:true,notified:false});

    // 3. Get available alternative slots
    let altMsg = '';
    try {
      const docData = await fbGet(`clinicas/${uid}/medicos/${docId}`);
      const fi = docData.fields||{};
      const schedDays=(fi.schedDays?.arrayValue?.values||[]).map(v=>parseInt(v.integerValue||v.doubleValue||0));
      const doc = {
        id:docId, schedDays,
        schedStart:fi.schedStart?.stringValue||'',schedEnd:fi.schedEnd?.stringValue||'',
        schedDuration:parseInt(fi.schedDuration?.integerValue||fi.schedDuration?.doubleValue||30),
        schedLunchStart:fi.schedLunchStart?.stringValue||'',schedLunchEnd:fi.schedLunchEnd?.stringValue||'',
      };

      // Find next 3 available days with free slots
      const today = new Date();
      const alternatives = [];
      for(let i=1; i<=14 && alternatives.length<2; i++){
        const d = new Date(today);
        d.setDate(today.getDate()+i);
        const dateStr = d.toISOString().slice(0,10);
        if(dateStr===date) continue;
        const allSlots = generateSlots(doc, dateStr);
        if(!allSlots.length) continue;

        // Get booked for that day
        const apts = await fbGet(`clinicas/${uid}/agendamentos`);
        const booked = (apts.documents||[])
          .map(a=>({docId:a.fields?.docId?.stringValue,date:a.fields?.date?.stringValue,time:a.fields?.time?.stringValue,status:a.fields?.status?.stringValue}))
          .filter(a=>a.docId===docId&&a.date===dateStr&&a.status!=='cancelled')
          .map(a=>a.time);
        const free = allSlots.filter(s=>!booked.includes(s));
        if(free.length){
          const[,mo,d2]=dateStr.split('-');
          const dayNames=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
          const dow=new Date(dateStr+'T12:00:00').getDay();
          alternatives.push(`• ${dayNames[dow]} ${d2}/${mo}: ${free.slice(0,3).join(', ')}`);
        }
      }
      if(alternatives.length) altMsg=`\n\nHorários disponíveis para reagendar:\n${alternatives.join('\n')}`;
    } catch(e){ console.error('Alt slots error:', e.message); }

    // 4. Format date
    const[,mo,d2]=date.split('-');
    const message=`Olá ${patientName}! 😔\n\nLamentamos informar que sua consulta com ${docName} em ${d2}/${mo} às ${time} foi cancelada pela clínica.${altMsg}\n\nPara reagendar, responda "quero reagendar" e teremos prazer em ajudar! 😊`;

    // 5. Send WhatsApp notification
    const jid = patientPhone.startsWith('55') ? patientPhone : '55'+patientPhone;
    await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE}`,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':EVOLUTION_KEY},
      body:JSON.stringify({number:jid+'@s.whatsapp.net',text:message})
    });

    console.log(`✅ Notificação enviada para ${patientPhone}`);
    return res.status(200).json({cancelled:true,notified:true,patient:patientName});
  } catch(e){
    console.error('cancel-notify error:', e.message);
    return res.status(500).json({error:e.message});
  }
}
