(function(){
  const MOTOR = ['Acko','Bajaj Allianz','Cholamandalam','Go Digit','HDFC Ergo','ICICI Lombard','IFFCO Tokio','Liberty','Magma HDI','National','SBI General','Shriram','Tata AIG','New India','Oriental','United','Universal Sompo','Zuno','Zurich Kotak','Raheja QBE','Royal Sundaram','Navi','IndusInd','Kshema','Kiwi','Protec','Generali Central'];
  const HEALTH = ['Star Health','Care Health','Niva Bupa','Aditya Birla Health','ManipalCigna'];
  const LIFE = ['LIC','HDFC Life','ICICI Prudential Life','SBI Life','Max Life','Bajaj Allianz Life','Tata AIA'];
  function apply(){
    const t=document.getElementById('type'); const c=document.getElementById('company')||document.getElementById('insurer');
    if(!t||!c) return; let list=MOTOR; const v=(t.value||'').toLowerCase();
    if(v.includes('health')) list=HEALTH; else if(v.includes('life')) list=LIFE;
    const cur=c.value; c.innerHTML='<option value="">-- Company --</option>'+list.map(x=>`<option>${x}</option>`).join(''); if(list.includes(cur)) c.value=cur;
  }
  document.addEventListener('change',e=>{ if(e.target.id==='type') apply(); });
  setInterval(apply,1500);
})();
