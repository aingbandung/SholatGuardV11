/* SholatGuard: jembatan Web Speech API -> plugin native Capacitor (hanya aktif di APK).
   WebView Android tidak punya speechSynthesis, jadi dibuat pengganti yang memakai plugin
   TextToSpeech & SpeechRecognition. Kode aplikasi tidak perlu diubah. */
(function(){
 var BUILD="v11 (2026-10-06)";
 var C=window.Capacitor||{},native=false;
 try{native=!!(window.androidBridge||(C.isNativePlatform&&C.isNativePlatform()))}catch(e){}
 function avail(n){try{return C.isPluginAvailable?!!C.isPluginAvailable(n):true}catch(e){return false}}
 function plug(n){try{if(C.registerPlugin)return C.registerPlugin(n)}catch(e){}return(C.Plugins&&C.Plugins[n])||null}
 var TTS=native?plug("TextToSpeech"):null,SRP=native?plug("SpeechRecognition"):null;
 var status=native?("APK · tts:"+(TTS&&avail("TextToSpeech")?"ok":"TIDAK ADA")+" · mic:"+(SRP&&avail("SpeechRecognition")?"ok":"TIDAK ADA")):"web";
 function tagUi(){document.querySelectorAll(".gft").forEach(function(g){if(g.textContent.indexOf("build ")<0)g.textContent+=" · build "+BUILD+" ["+status+"]"})}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",tagUi);else tagUi();
 if(!native||!TTS||!SRP)return;

 /* ---------- Text-to-speech ---------- */
 function Utt(t){this.text=t===undefined?"":String(t);this.lang="";this.rate=1;this.pitch=1;this.volume=1;this.voice=null;this.onend=null;this.onerror=null}
 var q=[],busy=false,gen=0;
 function pump(){
  if(busy)return;var u=q.shift();if(!u)return;
  if(!u.text||!u.text.trim()){if(u.onend)try{u.onend()}catch(e){}return pump()}
  busy=true;var my=gen;
  var wd=setTimeout(function(){logErr(u.lang||"id-ID","tidak ada respons dari mesin suara (timeout)");done(1)},Math.max(7000,u.text.length*220));
  function done(err){
   clearTimeout(wd);if(my!==gen)return;busy=false;
   try{err?(u.onerror&&u.onerror({error:"synthesis-failed"})):(u.onend&&u.onend())}catch(e){}
   pump()}
  function tryLang(lang,retry){
   var o={text:u.text,lang:lang,rate:u.rate||1,pitch:Math.min(2,Math.max(.5,u.pitch||1)),volume:1,queueStrategy:0};
   if(retry&&u.voice&&typeof u.voice._i==="number"&&String(u.voice.lang||"").toLowerCase().slice(0,2)===String(lang).toLowerCase().slice(0,2))o.voice=u.voice._i;
   TTS.speak(o).then(function(){done(0)},function(e){
    var m=String((e&&(e.message||e.errorMessage))||e);
    logErr(lang,m);
    if(my!==gen)return;
    if(retry&&!/^ar/i.test(lang))tryLang("en-US",false);   // suara bahasa itu belum terpasang -> coba suara Inggris agar tetap berbunyi
    else done(1)})}
  tryLang(u.lang||"id-ID",true);
 }
 var warned=false;
 function logErr(lang,m){
  try{var l=document.getElementById("log");if(l)l.innerHTML=new Date().toLocaleTimeString()+" 🔇 TTS error ("+lang+"): "+m+"<br>"+l.innerHTML}catch(e){}
  if(!warned){warned=true;
   alert("Suara tidak bisa diputar ("+lang+"): "+m+"\n\nPeriksa: Pengaturan > Sistem > Bahasa > Keluaran teks-ke-ucapan > pilih 'Layanan Ucapan Google' dan pasang data suara Indonesia/Arab. Pastikan juga volume Media tidak 0.")}}
 var vcache=[],lis=[],vtry=0;
 function fireV(){try{synth.onvoiceschanged&&synth.onvoiceschanged({})}catch(e){}lis.forEach(function(f){try{f({})}catch(e){}})}
 function loadVoices(){
  TTS.getSupportedVoices().then(function(r){
   var vl=(r&&r.voices)||[];
   vcache=vl.map(function(v,i){return{name:v.name||v.voiceURI,voiceURI:v.voiceURI,lang:v.lang,"default":!!v.default,localService:v.localService!==false,_i:i}});
   if(vcache.length)fireV();else if(++vtry<6)setTimeout(loadVoices,1500)
  },function(){if(++vtry<6)setTimeout(loadVoices,1500)})}
 var synth={speaking:false,pending:false,paused:false,onvoiceschanged:null,
  addEventListener:function(t,f){if(t==="voiceschanged")lis.push(f)},removeEventListener:function(){},
  speak:function(u){q.push(u);pump()},
  cancel:function(){gen++;q.length=0;busy=false;try{TTS.stop().catch(function(){})}catch(e){}},
  getVoices:function(){return vcache},pause:function(){},resume:function(){}};
 try{Object.defineProperty(window,"speechSynthesis",{value:synth,configurable:true,writable:true})}catch(e){window.speechSynthesis=synth}
 window.SpeechSynthesisUtterance=Utt;
 setTimeout(loadVoices,600);
 window.sgOpenTts=function(){try{TTS.openInstall()}catch(e){}};

 /* ---------- Speech recognition ---------- */
 /* Pengenal suara Android berhenti sendiri setiap jeda/diam, lalu harus dimulai ulang. Agar salam tidak
    terlewat di sela-sela itu, sesi dimulai ulang LANGSUNG di sini (tanpa lewat aplikasi) dan kondisi mati
    dideteksi lewat isListening(). */
 function Rec(){this.lang="id-ID";this.continuous=true;this.interimResults=true;this.maxAlternatives=3;
  this.onresult=null;this.onerror=null;this.onend=null;this.onstart=null;
  this._on=false;this._ses=0;this._ended=-1;this._t=null;this._poll=null;this._cap=null;this._last=null;this._lastAt=0;this._fails=0}
 Rec.prototype._emit=function(matches,fin){
  if(!this._on||!this.onresult||!matches||!matches.length)return;
  var alts=matches.map(function(t){return{transcript:t,confidence:.9}});alts.isFinal=!!fin;
  try{this.onresult({resultIndex:0,results:[alts]})}catch(e){}};
 Rec.prototype._clear=function(){clearTimeout(this._t);clearTimeout(this._cap);clearInterval(this._poll)};
 Rec.prototype._fail=function(code){
  var self=this;if(!self._on)return;self._on=false;self._clear();
  try{SRP.removeAllListeners()}catch(e){}
  if(self.onerror)try{self.onerror({error:code})}catch(e){}
  if(self.onend)try{self.onend()}catch(e){}};
 Rec.prototype._endSession=function(id,delay){      // sesi selesai -> hasil terakhir, lalu mulai sesi baru segera
  var self=this;if(!self._on||id!==self._ses||self._ended===id)return;self._ended=id;self._clear();
  if(self._last&&Date.now()-self._lastAt<3000)self._emit(self._last,true);
  self._last=null;
  setTimeout(function(){if(self._on)self._session()},delay===undefined?120:delay)};
 Rec.prototype._session=async function(){
  var self=this,id=++self._ses;self._clear();self._last=null;var stopped=false,t0=Date.now(),miss=0;
  try{
   await SRP.removeAllListeners();
   await SRP.addListener("partialResults",function(d){
     if(!self._on||id!==self._ses||!d||!d.matches||!d.matches.length)return;
     self._last=d.matches;self._lastAt=Date.now();self._emit(d.matches,false);
     if(stopped)self._endSession(id,60)});          // hasil akhir tiba setelah ucapan selesai
   await SRP.addListener("listeningState",function(d){
     if(id!==self._ses||!d||d.status!=="stopped")return;
     stopped=true;clearTimeout(self._t);self._t=setTimeout(function(){self._endSession(id,60)},600)});
   await SRP.start({language:self.lang||"id-ID",maxResults:3,partialResults:true,popup:false});
   if(!self._on||id!==self._ses)return;
   self._fails=0;if(self.onstart&&id===1)try{self.onstart()}catch(e){}
   self._poll=setInterval(async function(){            // recognizer mati karena error/timeout diam tanpa event
     if(!self._on||id!==self._ses||Date.now()-t0<1500)return;
     try{var r=await SRP.isListening();miss=(r&&r.listening)?0:miss+1;if(miss>=2)self._endSession(id,60)}catch(e){}},350);
   self._cap=setTimeout(function(){self._endSession(id,60)},25000);   // pengaman
  }catch(e){
   if(!self._on||id!==self._ses)return;
   if(++self._fails>=6)return self._fail("not-allowed");
   self._t=setTimeout(function(){if(self._on)self._session()},1200)}};
 Rec.prototype.start=function(){
  var self=this;if(self._on)return;self._on=true;self._fails=0;
  (async function(){
   try{
    var av=await SRP.available();
    if(!av||!av.available){alert("Layanan pengenalan suara Google tidak ditemukan di HP ini. Pasang/aktifkan aplikasi Google (Speech Services) lalu coba lagi.");return self._fail("service-not-allowed")}
    var p=await SRP.checkPermissions();
    if(!p||p.speechRecognition!=="granted")p=await SRP.requestPermissions();
    if(!p||p.speechRecognition!=="granted")return self._fail("not-allowed");
    if(self._on)self._session();
   }catch(e){self._fail("not-allowed")}
  })()};
 Rec.prototype.stop=Rec.prototype.abort=function(){
  var self=this;if(!self._on)return;self._on=false;self._ses++;self._clear();
  try{SRP.stop().catch(function(){})}catch(e){}try{SRP.removeAllListeners()}catch(e){}
  if(self.onend)try{self.onend()}catch(e){}};
 window.SpeechRecognition=Rec;window.webkitSpeechRecognition=Rec;

 /* ---------- Tombol diagnosa suara (Profile, di samping tombol Voice) ---------- */
 function msg(e){return String((e&&(e.message||e.errorMessage))||e)}
 async function diag(){
  var r=[],ok="id-ID";
  try{var g=await TTS.getSupportedLanguages();r.push("Mesin TTS aktif. Jumlah bahasa: "+((g.languages||[]).length))}
  catch(e){r.push("Mesin TTS TIDAK aktif / gagal start: "+msg(e))}
  var sup={};
  for(var l of["id-ID","en-US","ar-SA"]){
   try{var x=await TTS.isLanguageSupported({lang:l});sup[l]=!!x.supported;r.push(l+": "+(x.supported?"OK":"data suara belum terpasang"))}
   catch(e){r.push(l+": error "+msg(e))}}
  if(!sup["id-ID"])ok=sup["en-US"]?"en-US":"id-ID";
  var res=await Promise.race([
   TTS.speak({text:ok==="id-ID"?"Tes suara berhasil":"Voice test",lang:ok,rate:1,pitch:1,volume:1,queueStrategy:0}).then(function(){return"selesai diputar"},function(e){return"ERROR: "+msg(e)}),
   new Promise(function(f){setTimeout(function(){f("TIDAK ADA RESPONS (6 dtk)")},6000)})]);
  r.push("Tes bicara ("+ok+"): "+res);
  r.push("Jika tertulis selesai tapi tidak terdengar: naikkan volume MEDIA.");
  alert(r.join("\n"));
  if(confirm("Buka pengaturan data suara teks-ke-ucapan sekarang?")){try{TTS.openInstall()}catch(e){}}
 }
 function addBtn(){
  var vo=document.getElementById("vo");if(!vo||document.getElementById("sgTts"))return;
  var b=document.createElement("button");b.id="sgTts";b.textContent="🔈 Tes suara";b.onclick=diag;vo.insertAdjacentElement("afterend",b)}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",addBtn);else addBtn();

 /* ---------- Minta izin kamera + mikrofon saat aplikasi pertama kali dibuka ---------- */
 var PK="sg_perm_asked";
 async function askPerms(){
  try{if(localStorage.getItem(PK))return}catch(e){}
  try{var st=await navigator.mediaDevices.getUserMedia({video:true,audio:false});st.getTracks().forEach(function(t){t.stop()})}catch(e){}   // dialog izin KAMERA
  try{var p=await SRP.checkPermissions();if(!p||p.speechRecognition!=="granted")await SRP.requestPermissions()}catch(e){}                    // dialog izin MIKROFON
  try{localStorage.setItem(PK,"1")}catch(e){}
 }
 setTimeout(askPerms,800);
})();
