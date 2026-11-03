/* THE LAST VILLAGE — PART 2 CONFIG: NPC dialogue, missions, quest items.  (data only — the engine is js/p2-story.js)
 *
 * QUEST CHAIN (one mission active at a time; every mission unlocks the next one):
 *   1 Raghunath  toolbox  ->  2 Kamla Devi  letters  ->  3 Dr. Arvind  register  ->  4 Shyamlal  lantern + watchtower
 *   ->  5 Chotu  drawing book  ->  6 Graveyard  "The Forgotten Grave"  ->  7 Dev  missing villager + diary
 *
 * Quest  : { id, npc, title, short, locked:[lines], done:[lines], stages:[ ... ] }
 * Stage types
 *   talk    { npc, obj, lines }              finish the dialogue with that NPC -> next stage
 *   collect { obj, items:[itemId...] }       interact with every item (counter n/N)
 *   reach   { obj, where:'tower'|'graveyard' }   walk to a place (checked every frame)
 *   any stage may carry  remind:[lines]  = what the stage's NPC says when the player talks to him again too early
 * Dialogue line  : 'text'  (said by the NPC)   or  ['Speaker', 'text']   or  ['', 'narration text']  (speaker 'Tum' by default)
 * Item  : { x, z, snap, verb, model, speaker, read:[lines], name:'forgotten name revealed' }   x,z = WORLD metres.
 *   'near':'clinic'|'graveyard' + dx,dz = offset from the clinic interior centre / the graveyard map centre instead of absolute x,z.
 * Everything is in Hinglish. Positions are STARTING POINTS (snap:true = nudged to the nearest free spot if blocked) — tune them here, nothing else needs touching.
 */
(function () {
  'use strict';
  const P2 = (window.P2 = window.P2 || {});

  P2.config = {
    talkDist: 2.9,          // m: how close the player must be to an NPC to talk
    talkCone: 0.25,         // min dot(view direction, direction to NPC) when farther than talkNear
    talkNear: 1.7,          // m: closer than this = no need to look at the NPC
    pickDist: 2.0,          // m: pick-up distance for quest items
    typeSpeed: 38,          // characters per second (typing effect)
    save: true,             // keep progress in localStorage (the graphics selector reloads the page!)  ?newgame resets
    places: {
      tower:     { x: 13,  z: 67, r: 6.5, minY: 5.5 },     // top deck of the watchtower (stairs lift the player: P1.gy > minY) within r metres
      graveyard: { cx: -26, cz: 38, half: 11.2 }            // inside the iron fence (same as p1-gate.js CFG)
    },

    /* ---------------------------------------------------------------------------------- ITEMS (spawned only while their stage is active) */
    items: {
      toolbox: { x: 18.4, z: 31.2, snap: true, model: 'toolbox', verb: '🧰 Toolbox uthao', speaker: 'Tum',
        read: [['', 'Zang lagi hui lohe ki peti. Dhakkan par chaak se likha hai: "R. — Raghunath Garage".'], ['Tum', 'Yehi hai! Kisi ne ise windmill ke paas phenk diya tha… par kyun?']] },

      letter1: { x: 7.6, z: 24.0, snap: true, model: 'letter', verb: '✉️ Chitthi uthao', speaker: 'Chitthi 1',
        read: [['', 'Peeli padi hui chitthi. Syaahi dhundli hai, par naam saaf padha jaata hai.'], ['Chitthi', '"Meri pyari Kamla… Hari Prasad ab ghar nahi laut paayega. Unhone use qabristan ke peeche daba diya, kisi ko batane se pehle hi…"'], ['Tum', 'Hari Prasad… Ye naam pehle kabhi nahi suna.']], name: 'Hari Prasad' },
      letter2: { x: 8.4, z: 45.5, snap: true, model: 'letter', verb: '✉️ Chitthi uthao', speaker: 'Chitthi 2',
        read: [['', 'Aadhi jali hui chitthi. Kinaare par bachchon ki likhawat jaisa kuch likha hai.'], ['Chitthi', '"…Savitri ko bhi wahin le gaye. Gaon ne kaha — jo naam mita do, wo yaad nahi rehta. Isliye register se naam kaat diye gaye…"'], ['Tum', 'Naam kaat diye gaye? Poora gaon kuch chhupa raha hai.']], name: 'Savitri' },
      letter3: { x: -11.6, z: 46.4, snap: true, model: 'letter', verb: '✉️ Chitthi uthao', speaker: 'Chitthi 3',
        read: [['', 'Aakhri chitthi, qabristan ki baad ke paas gili mitti mein dabi thi.'], ['Chitthi', '"Agar tum ye padh rahi ho Kamla, to samajh lo — wo kabr abhi bhi wahin hai. Jahan neend nahi, wahin yaad hai. Laalten wale ko dhoondhna."'], ['Tum', 'Qabristan… "bhooli hui kabr". Isse pata lagana padega.']] },

      register: { near: 'clinic', dx: -3.4, dz: -1.0, snap: true, model: 'register', verb: '📕 Register uthao', speaker: 'Tum',
        read: [['', 'Mota hara register. Andar ke panne phate hue hain — kuch naam kaale rang se mita diye gaye hain.'], ['Register', '"Baldev — bukhaar, 1987. Baldev — bukhaar, 1987. Munna (6 saal) — laapata. Lakshmi — …" Baaki panna jala hua hai.'], ['Tum', 'Baldev, Munna, Lakshmi… Aur kitne naam mite hue hain?']], name: 'Baldev, Munna, Lakshmi' },

      lantern: { x: -6.0, z: 52.4, snap: true, model: 'lantern', verb: '🏮 Laalten uthao', speaker: 'Tum',
        read: [['', 'Purani peetal ki laalten. Andar ek chhoti si lau ab bhi kaanp rahi hai — jabki hawa band hai.'], ['Tum', 'Ye khud jal rahi hai? …Shyamlal ko dikhana padega. Phir tower par chadhna hai.']] },

      drawing: { x: 0.3, z: 43.6, snap: true, model: 'drawing', verb: '📓 Drawing book uthao', speaker: 'Tum',
        read: [['', 'School ke aangan mein ek mod diya hua drawing book. Mom, Dad, ghar, ped… aur ek akeli kabr jiske upar ek bachcha khada hai.'], ['Tum', 'Chotu ne ye kabr kab dekhi? Neeche ek naam likha hai: "Gopal".']], name: 'Gopal' },

      // The Forgotten Grave (positions: graveyard map centre + offset; chosen in free gaps between the tombs, see tools/ notes in docs/CHANGES_part2.md)
      hidden_grave: { near: 'graveyard', dx: -5.0, dz: -5.0, snap: false, model: 'grave', verb: '🪦 Chhupi hui kabr dekho', speaker: 'Tum',
        read: [['', 'Do tombon ke beech ki mitti thodi uthi hui hai. Pattharon ke neeche ek chhoti si, bhooli hui kabr — par is par koi naam nahi.'], ['Tum', 'Ye wahi kabr hai jiski chitthiyon mein baat thi… Aas-paas ke patthar bhi dekhne chahiye.']] },
      name_stone1: { near: 'graveyard', dx: -4.1, dz: -4.7, snap: false, model: 'stone', verb: '🪨 Patthar padho', speaker: 'Tum',
        read: [['', 'Kaai se dhaki chhoti patti. Ungliyon se kaai hataate hi khurche hue akshar ubhar aate hain.'], ['Patthar', '"HARI PRASAD — jise gaon ne bhula diya."'], ['Tum', 'Chitthi wale Hari Prasad…']], name: 'Hari Prasad (kabr)' },
      name_stone2: { near: 'graveyard', dx: -5.9, dz: -5.3, snap: false, model: 'stone', verb: '🪨 Patthar padho', speaker: 'Tum',
        read: [['Patthar', '"SAVITRI aur LAKSHMI — ek hi raat, ek hi chita."'], ['Tum', 'Register mein jinke naam mite the… ye unki kabr hai.']], name: 'Savitri, Lakshmi (kabr)' },
      name_stone3: { near: 'graveyard', dx: -5.0, dz: -3.9, snap: false, model: 'stone', verb: '🪨 Patthar padho', speaker: 'Tum',
        read: [['Patthar', '"BALDEV. MUNNA. GOPAL. Hum sab yahin hain. Humein bhoolo mat."'], ['', 'Hawa achanak thandi ho gayi. Kahin peeche se kisi ne dheere se saans li.'], ['Tum', '(Peeche koi nahi tha.)']], name: 'Baldev, Munna, Gopal (kabr)' },

      // Dev: missing villager + diary
      diary1: { x: -12.2, z: 31.6, snap: true, model: 'diary', verb: '📖 Diary ka panna uthao', speaker: 'Diary',
        read: [['', 'Pehle panna. Hathon se likha, jaldi mein.'], ['Diary', '"Mohan peeche jungle ki taraf gaya tha, kaha tha raat se pehle aa jaaunga. Teen din ho gaye."'], ['Tum', 'Mohan… wahi missing villager hoga.']] },
      diary2: { x: 9.8, z: 54.8, snap: true, model: 'diary', verb: '📖 Diary ka panna uthao', speaker: 'Diary',
        read: [['Diary', '"Raat ko tower ki taraf se laalten ki roshni dikhi. Phir wo roshni qabristan ki taraf chali gayi — bina kisi ke haath ke."'], ['Tum', 'Wahi laalten jo mujhe mili thi…']] },
      diary3: { x: -2.0, z: 5.5, snap: true, model: 'diary', verb: '📖 Diary ka panna uthao', speaker: 'Diary',
        read: [['Diary', '"Agar Mohan nahi laut paaya, to wo SAAYA ke paas hoga. Wo har us aadmi ko le jaati hai jo qabristan ka raaz jaan jaata hai. Mere paas ab sirf ek raasta bacha hai."'], ['Tum', 'SAAYA… Ye naam har jagah aa raha hai.']] },
      mohan_coat: { x: -22.5, z: 55.5, snap: true, model: 'coat', verb: '🧥 Kapde ko dekho', speaker: 'Tum',
        read: [['', 'Jungle ke kinaare kichad mein ek bhaari bhura coat. Jeb mein gaon ka purana pass aur ek jala hua kagaz — "MOHAN".'], ['Tum', 'Paon ke nishaan sidhe qabristan ki baad tak jaate hain… aur wahan ruk jaate hain.'], ['', 'Jaise Mohan zameen mein hi gaayab ho gaya ho.']] }
    },

    /* ---------------------------------------------------------------------------------- QUESTS */
    quests: [
      { id: 'q_raghunath', npc: 'raghunath', title: 'Raghunath — Gayab Toolbox', short: 'Toolbox dhoondo',
        locked: ['Abhi busy hoon.'],
        done: ['Teri wajah se meri aadhi zindagi wapas mili. Kamla Devi ka haal pooch lena, wo kal se kuch dhoondh rahi hai.', 'Aur sun… raat mein akele mat ghoomna. Yahan "koi" hamesha dekhta rehta hai.'],
        stages: [
          { type: 'talk', npc: 'raghunath', obj: 'Raghunath se baat karo',
            lines: ['Arre! Tum naye ho gaon mein? Is waqt raat ko, is sadak par?', 'Meri garage ka toolbox gayab ho gaya hai. Subah tak yahin tha, ab nahi hai. Bina auzaar ke main kuch bhi theek nahi kar sakta.', 'Mujhe lagta hai kisi ne windmill ki taraf phenk diya. Wahan jaake dekh lo — meharbani hogi.'] },
          { type: 'collect', obj: 'Windmill ke paas Raghunath ka toolbox dhoondo', items: ['toolbox'],
            remind: ['Toolbox abhi nahi mila? Windmill ke paas, east ki taraf kheton mein dekho.'] },
          { type: 'talk', npc: 'raghunath', obj: 'Toolbox Raghunath ko lauta do',
            lines: ['Yehi hai! Mere auzaar… Tumne kamaal kar diya.', 'Waise ek baat — ye toolbox kisi ne bahut jaldi mein phenka tha. Jaise koi kuch chhupa raha ho.', 'Kamla Devi ke paas jao. Uski chitthiyan bhi gayab hain, mujhe lagta hai dono baatein judi hain.'] }
        ] },

      { id: 'q_kamla', npc: 'kamla', title: 'Kamla Devi — Gayab Chitthiyan', short: 'Teen chitthiyan dhoondo',
        locked: ['Beta, abhi mat aao… pehle Raghunath ki madad kar do. Wo bhi pareshaan hai.'],
        done: ['Ab mujhe sab yaad aa raha hai. Wo kabr bhooli nahi gayi… sirf chhupa di gayi hai.', 'Dr. Arvind ke register mein bhi wahi naam honge. Unse milo.'],
        stages: [
          { type: 'talk', npc: 'kamla', obj: 'Kamla Devi se baat karo',
            lines: ['Raghunath ne bheja hai tumhe? Achha… Beta, meri teen chitthiyan kisi ne chura li hain.', 'Unmein mere pati ke baare mein sab likha tha. Hawa ke saath udd gayi hongi, ya kisi ne… udwayi hongi.', 'Ek sadak ke kinaare, ek school ki taraf, aur ek qabristan ki baad ke paas… wahi teen jagah yaad hain. Dhoondh lo, bhagwan tumhara bhala kare.'] },
          { type: 'collect', obj: 'Kamla Devi ki chitthiyan dhoondo', items: ['letter1', 'letter2', 'letter3'],
            remind: ['Teen chitthiyan hain, beta. Ek sadak ke kinaare, ek school ki taraf, ek qabristan ki baad ke paas.'] },
          { type: 'talk', npc: 'kamla', obj: 'Chitthiyan Kamla Devi ko do',
            lines: ['Haan… ye meri hi likhawat hai. Hari Prasad… Savitri…', 'Ye log kabhi maare nahi gaye the, beta. Bas… bhula diye gaye. Gaon ne unke naam register se kaat diye.', 'Dr. Arvind ke paas wo register hoga. Jaao, unse poochho. Par jaldi karna.'] }
        ] },

      { id: 'q_arvind', npc: 'arvind', title: 'Dr. Arvind — Gayab Medical Register', short: 'Medical register dhoondo',
        locked: ['Clinic band hai… Kal aana. Kamla ka kaam khatam hone do.'],
        done: ['Register wapas aa gaya. Ab saaf hai — ye gaon beemaari se nahi, kisi aur cheez se mara tha.', 'Shyamlal watchtower ke paas rehta hai. Usne bhi kuch dekha hai, aur uski laalten kho gayi hai. Usse milo.'],
        stages: [
          { type: 'talk', npc: 'arvind', obj: 'Dr. Arvind se baat karo',
            lines: ['Kaun? Oh… tum. Darwaza khula hi tha.', 'Mera medical register gayab hai. Wahi, jismein purane marizon ke naam darj the. Ek raat mein mere desk se uthaya gaya.', 'Mujhe lagta hai kisi ne use clinic ke peeche, west deewar ki taraf phenk diya hai. Plis, dhoondo — wo register sirf kagaz nahi, saboot hai.'] },
          { type: 'collect', obj: 'Clinic ke peeche Dr. Arvind ka medical register dhoondo', items: ['register'],
            remind: ['Clinic ke west deewar ke bahar dekho, jahaan jhaadiyaan hain.'] },
          { type: 'talk', npc: 'arvind', obj: 'Register Dr. Arvind ko do',
            lines: ['Haan! Yahi hai… ye kaale nishaan kisi ne jaanbujhkar lagaye hain.', 'Baldev, Munna, Lakshmi… main inhe jaanta tha. Maine unka ilaaj kiya tha. Phir ek din sab ke naam gaayab ho gaye.', 'Shyamlal ko dhoondo. Wo watchtower par raat ko pehra deta hai. Uski laalten kho gayi hai — usse madad chahiye.'] }
        ] },

      { id: 'q_shyamlal', npc: 'shyamlal', title: 'Shyamlal — Laalten aur Watchtower', short: 'Laalten dhoondo, tower par chadho',
        locked: ['Raat ka pehra hai. Doctor se milke aao, tab baat karenge.'],
        done: ['Tumne wo sab dekha jo main roz dekhta hoon. Ab maano — qabristan mein kuch hai.', 'Chotu school ke aas-paas rehta hai. Wo kuch banata rehta hai… uski drawing book ke baare mein poochho.'],
        stages: [
          { type: 'talk', npc: 'shyamlal', obj: 'Shyamlal se baat karo',
            lines: ['Ruko! Aage mat badho… Oh, tum ho. Dr. Arvind ne bheja hoga.', 'Meri laalten kho gayi hai. Bina uske raat ko tower par chadhna maut ko bulaane jaisa hai. Wo aakhri baar school ke peeche wale raaste par thi.', 'Laalten dhoondo. Phir tower par chadho — wahan se poora gaon dikhta hai, aur wo roshni bhi.'] },
          { type: 'collect', obj: 'Shyamlal ki laalten dhoondo (school ke peeche, west taraf)', items: ['lantern'],
            remind: ['Laalten school ke peeche, west tree line ke paas hogi.'] },
          { type: 'reach', obj: 'Watchtower ke upar (top deck) tak chadho', where: 'tower',
            remind: ['Tower ki seedhiyan chadho. Upar se hi dikhega.'] },
          { type: 'talk', npc: 'shyamlal', obj: 'Neeche aakar Shyamlal se baat karo',
            lines: ['Dekha? Wo roshni qabristan ki taraf se aati hai… Roz raat ko, theek barah baje.', 'Maine kai baar jaake dekhna chaha, par har baar kuch peeche se mera naam leta hai.', 'Chotu ki drawing book mein bhi kabr dikhti hai. Wo school ke aas-paas khel raha hoga. Usse dhoondo.'] }
        ] },

      { id: 'q_chotu', npc: 'chotu', title: 'Chotu — School ki Drawing Book', short: 'Drawing book dhoondo',
        locked: ['Mujhe akela rehne do… mummy ne kaha tha ajnabiyon se baat mat karna.'],
        done: ['Main wahan nahi jaata. Par tum ja sakte ho. Kabr ke paas khade hone par "wo" tumhe dekhegi.', 'Meri drawing mein jo kabr hai… wahi hai.'],
        stages: [
          { type: 'talk', npc: 'chotu', obj: 'Chotu se baat karo',
            lines: ['…Kaun ho aap? Aap bhoot to nahi ho na?', 'Meri drawing book school mein gir gayi. Usmein mainne wo sab banaya jo raat ko dikhta hai. Mujhe darr lagta hai wapas jaane mein.', 'School ke aangan mein dekho… jahaan peeli diwaar hai. Please le aao.'] },
          { type: 'collect', obj: 'School ke aangan mein Chotu ki drawing book dhoondo', items: ['drawing'],
            remind: ['Drawing book school ke aangan mein hai. Please jaldi…'] },
          { type: 'talk', npc: 'chotu', obj: 'Drawing book Chotu ko lauta do',
            lines: ['Meri book! Shukriya aapka!', 'Isme ek kabr hai jise koi nahi dekhta. Mainne use sapne mein dekha tha — qabristan ke andar, do bade pattharon ke beech.', 'Wahan sirf un logon ko ek naam sunayi deta hai jo… bhule hue ko yaad karte hain.'] }
        ] },

      { id: 'q_graveyard', npc: null, title: 'The Forgotten Grave', short: 'Chhupi kabr aur bhule hue naam',
        stages: [
          { type: 'reach', obj: 'Qabristan ke andar jao (east gate: darwaza kholo)', where: 'graveyard' },
          { type: 'collect', obj: 'Do bade tombon ke beech chhupi kabr dhoondo', items: ['hidden_grave'] },
          { type: 'collect', obj: 'Kabr ke aas-paas ke patthar padho — bhule hue naam (0/3)', items: ['name_stone1', 'name_stone2', 'name_stone3'] }
        ],
        onDone: ['', 'Sab naam mil gaye: Hari Prasad, Savitri, Baldev, Munna, Lakshmi, Gopal. Qabristan mein ab kuch bhi shaant nahi raha…'] },

      { id: 'q_dev', npc: 'dev', title: 'Dev — Gayab Gaonwala aur Diary', short: 'Mohan aur diary ke panne',
        locked: ['Abhi nahi. Pehle ye sab khatam karo — tumne jo kabr dekhi hai, uske baare mein baad mein.'],
        done: ['Mohan ke saath jo hua, wahi Gopal ke saath hua tha. Aur ab wo rukegi nahi.', 'Main nahi jaanta tumhein kitna bata doon. Agle raat ka intezaar karo… jo hone wala hai uske liye taiyaar rehna.'],
        stages: [
          { type: 'talk', npc: 'dev', obj: 'Dev se baat karo',
            lines: ['Tumne qabristan dekh liya, hai na? Mujhe tumhari aankhon mein dikh raha hai.', 'Mera dost Mohan teen din pehle jungle ki taraf gaya tha. Wapas nahi aaya. Uski diary ke panne hawa mein udd gaye — gaon mein idhar-udhar bikhre honge.', 'Teen panne dhoondo. Phir jungle ke kinaare uska last-seen spot dekho. Mujhe sach jaanna hai.'] },
          { type: 'collect', obj: 'Mohan ki diary ke 3 panne dhoondo (0/3)', items: ['diary1', 'diary2', 'diary3'],
            remind: ['Teen panne hain. Ek mere ghar ke paas, ek tower ki taraf, ek shuruaati raaste par.'] },
          { type: 'collect', obj: 'Jungle ke kinaare gayab Mohan ka last-seen spot dekho', items: ['mohan_coat'],
            remind: ['Diary kehti hai wo jungle ke west kinaare gaya tha. Wahin dekho.'] },
          { type: 'talk', npc: 'dev', obj: 'Dev ko sab bata do',
            lines: ['Coat… Mohan ka. Aur jala hua kagaz? Ye wahi nishaan hai jo Hari Prasad ke register mein tha.', 'To ye sab ek hi chain hai. Wo har us ko le jaati hai jo qabristan ka raaz jaan jaata hai.', 'Bas. Ab aur nahi — kal ka din aane do. Jo aage hoga, uske liye taiyaar rehna.'] }
        ],
        onDone: ['', 'Part 2 ke saare missions poore hue. Kahani abhi khatam nahi hui…'] }
    ],

    /* generic lines (fallbacks / chatter) */
    chatter: {
      raghunath: ['Ab kya chahiye? Toolbox mil gaya, bas thodi der aur…', 'Ye gaon raat ko zinda ho jaata hai. Sambhal ke.'],
      kamla: ['Beta, bhagwan tumhe salamat rakhe.', 'Mere pati ki yaad aati hai… har raat.'],
      arvind: ['Register ke naam mat bhoolna.', 'Main sirf ek doctor hoon. Par ye gaon beemar nahi tha.'],
      shyamlal: ['Raat lambi hai. Aankhein khuli rakho.', 'Tower se main sab dekhta hoon… par sab kuch nahi.'],
      chotu: ['Wo kabr… mat dekhna zyada der tak.', 'Meri drawing safe hai na?'],
      dev: ['Mohan ko dhoondhna mere liye sab kuch hai.', 'Kisi par bharosa mat karna. Sirf diary par.'],
      saaya: ['…']
    }
  };
})();
