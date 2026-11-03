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
      tower:     { x: 13,  z: 67, r: 6.5, minY: 5.5 },
      garage:    { x: 18.4, z: 31.2, r: 7.0 },     // top deck of the watchtower (stairs lift the player: P1.gy > minY) within r metres
      graveyard: { cx: -26, cz: 38, half: 11.2 }            // inside the iron fence (same as p1-gate.js CFG)
    },

    /* ---------------------------------------------------------------------------------- ITEMS (spawned only while their stage is active) */
    items: {
      toolbox: { x: 18.4, z: 31.2, snap: true, model: 'toolbox', asset: 'assets/props/story/toolbox.glb', verb: '🧰 Toolbox uthao', speaker: 'Tum',
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

      drawing: { x: 0.3, z: 43.6, snap: true, model: 'drawing', asset: 'assets/props/story/sketchbook.glb', verb: '📓 Drawing book uthao', speaker: 'Tum',
        read: [['', 'School ke aangan mein ek mod diya hua drawing book. Mom, Dad, ghar, ped… aur ek akeli kabr jiske upar ek bachcha khada hai.'], ['Tum', 'Chotu ne ye kabr kab dekhi? Neeche ek naam likha hai: "Gopal".']], name: 'Gopal' },

      tracks: { x: 20.8, z: 29.8, snap: true, model: 'stone', verb: '👣 Nishaan investigate karo', speaker: 'Tum',
        read: [['', 'Mitti mein do tarah ke tyre marks hain. Ek tumhari car ke jaise… doosre bahut purani gaadi ke.'], ['Tum', 'Purani gaadi workshop se yahan tak aayi thi. Accident se pehle koi mera intezaar kar raha tha?']] },
      torn_note: { x: 16.1, z: 34.0, snap: true, model: 'letter', asset: 'assets/props/story/rusty_key.glb', verb: '🗝️ Zang lagi chaabi examine karo', speaker: 'Tum',
        read: [['', 'Chaabi ke saath kapde ka jala hua tukda bandha hai. Is par tumhare bachpan ke naam ka pehla akshar likha hai.'], ['Tum', 'Ye chaabi kis ghar ki hai? Raghunath iske baare mein kuch jaanta hoga.']], scare: true },
      clinic_key: { near: 'clinic', dx: 2.0, dz: 1.5, snap: true, model: 'letter', asset: 'assets/props/story/rusty_key.glb', verb: '🗝️ Drawer ki chaabi dekho', speaker: 'Tum',
        read: [['', 'Desk ke neeche purani chaabi mili. Us par clinic ka nishaan hai.'], ['Tum', 'Doctor ne drawer kyun lock kiya hua tha?']], scare: true },
      family_photo: { near: 'clinic', dx: -1.0, dz: -1.8, snap: true, model: 'drawing', verb: '🖼️ Tasveer examine karo', speaker: 'Tum',
        read: [['', 'Purani family photograph. Ek bachcha camera ki taraf peeth karke khada hai. Tasveer ke peeche tareekh 18 saal purani hai.'], ['Tum', 'Ye ghar… mujhe sapne mein dikh chuka hai.'], ['Tum', 'Tasveer ke peeche mera bachpan ka naam likha hai.']], scare: true },
      bell_clue: { x: 14.5, z: 66.0, snap: true, model: 'lantern', verb: '🔔 Ghanti ke nishaan dekho', speaker: 'Tum',
        read: [['', 'Ghanti ke neeche deewar par paanch kharoche hue nishaan hain. Har nishaan ke saath ek naam ka pehla akshar.'], ['Tum', 'Ye ghanti kisi ko bulane ke liye bajayi jaati thi… ya kisi ko rokne ke liye?']] },
      school_bag: { x: 2.2, z: 42.0, snap: true, model: 'drawing', asset: 'assets/props/story/school_bag.glb', verb: '🎒 School bag check karo', speaker: 'Tum',
        read: [['', 'Bag ke andar purani class photo aur ek aadha jala admission card hai.'], ['Tum', 'Admission card par wahi bachpan ka naam hai jo clinic ki tasveer ke peeche likha tha.']] },
      child_drawing: { x: -1.6, z: 45.2, snap: true, model: 'drawing', asset: 'assets/props/story/sketchbook.glb', verb: '🖍️ Drawing ko dhyan se dekho', speaker: 'Tum',
        read: [['', 'Drawing mein ek bachcha gaon ke gate ke paas khada hai. Uske peeche ek lamba saaya hai.'], ['Tum', 'Ye bachcha… main hoon?'], ['', 'Door kahin se lakdi ke darwaze par teen baar dastak hoti hai.']], scare: true },

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
      { id: 'q_raghunath', npc: 'raghunath', title: 'The Return — Workshop ka Raaz', short: 'Workshop ke clues investigate karo',
        locked: ['Pehle gaon mein thoda ghoom lo. Mujhe tumhara chehra jaana-pehchana lagta hai…'],
        done: ['Ab mujhe yaad aa gaya… tum us raat gaon mein the. Lekin maine tumhe yahan dekha hi nahi tha. Kamla se milo. Uske paas purane khat hain.'],
        stages: [
          { type: 'talk', npc: 'raghunath', obj: 'Raghunath se workshop ke baare mein poochho', lines: [
            ['Raghunath','Ruko… tumhara chehra. Nahi, mumkin nahi. Tum itne saal baad…'],
            ['Tum','Aap mujhe jaante hain?'],
            ['Raghunath','Maine aisa kab kaha? Meri workshop mein raat ko koi ghusa tha. Toolbox gayab hai, aur zameen par ajeeb nishaan hain. Agar sach mein madad karni hai, workshop khud dekh lo.'],
            ['Raghunath','Aur haan… jo bhi mile, pehle dhyan se dekhna. Har cheez uthana zaroori nahi.'] ] },
          { type: 'inspect', obj: 'Workshop mein teen clues investigate karo (0/3)', items: ['toolbox','tracks','torn_note'], remind: ['Workshop ke aas-paas dekho. Toolbox ke alawa mitti aur purane kapde ka tukda bhi kuch batayega.'] },
          { type: 'reach', obj: 'Workshop ke andar wapas jaakar nishaan milao', where: 'garage' },
          { type: 'talk', npc: 'raghunath', obj: 'Raghunath se clues ke baare mein sawaal karo', lines: [
            ['Tum','Yahan purani gaadi ke tyre marks hain. Aur ye chaabi… is par mere naam ka pehla akshar hai.'],
            ['Raghunath','Ye chaabi tumhare purane ghar ki hai. Us raat ke baad us ghar ko band kar diya gaya tha.'],
            ['Tum','Kaunsi raat?'],
            ['Raghunath','Kamla se milo. Uske paas woh khat hain jo kisi ko nahi padhne chahiye the.'] ] }
        ] },

      { id: 'q_kamla', npc: 'kamla', title: 'The Missing Letters — Chhupi Hui Sachchai', short: 'Purane khat padho aur unka raaz samjho',
        locked: ['Beta, abhi nahi. Raghunath se jo baat karni thi, pehle woh poori karo.'],
        done: ['Maine tumhe bachpan mein dekha tha. Tumhari maa tumhe lekar bhaagi thi. Dr. Arvind ke paas us raat ka medical record hai.'],
        stages: [
          { type: 'talk', npc: 'kamla', obj: 'Kamla se purane khaton ke baare mein poochho', lines: [
            ['Kamla Devi','Tum wapas aa gaye… mujhe laga tha tum kabhi nahi lautoge.'],
            ['Tum','Aap mujhe pehchanti hain?'],
            ['Kamla Devi','Main tumhari maa ko jaanti thi. Usne mujhe kuch khat diye the. Koi unhe dhoondh raha hai. Teen khat gaon mein chhupaye gaye hain. Unhe padho, lekin unmein likhe naam zor se mat lena.'] ] },
          { type: 'inspect', obj: 'Teen purane khat padhkar unke naam note karo (0/3)', items: ['letter1','letter2','letter3'], remind: ['Khat alag-alag jagah chhupaye gaye hain. Har khat mein ek naam aur ek jagah ka zikr hai.'] },
          { type: 'talk', npc: 'kamla', obj: 'Khaton mein mile naam Kamla ko batao', lines: [
            ['Tum','Hari Prasad, Savitri… aur ek aisi kabr jiska naam kisi record mein nahi.'],
            ['Kamla Devi','Woh log mare nahi the… unhe gaon ki yaadon se mita diya gaya. Us raat bachchon ko clinic le jaya gaya tha. Dr. Arvind se milo. Usne tumhara ilaaj kiya tha.'],
            ['Tum','Mera?'],
            ['Kamla Devi','Haan. Tumhe yaad nahi hoga.'] ] }
        ] },

      { id: 'q_arvind', npc: 'arvind', title: 'The Medical Record — Woh Bachcha Kaun Tha?', short: 'Clinic ke records aur locked drawer investigate karo',
        locked: ['Clinic mein abhi kaam chal raha hai. Kamla se baat karke aao.'],
        done: ['Maine tumhe bachaya nahi tha… maine sirf tumhe gaon se bahar bhejne mein madad ki thi. Shyamlal ne us raat tower se sab dekha.'],
        stages: [
          { type: 'talk', npc: 'arvind', obj: 'Dr. Arvind se apne bachpan ke baare mein poochho', lines: [
            ['Dr. Arvind','Kamla ne tumhe bheja hai? Mujhe umeed thi ye din kabhi nahi aayega.'],
            ['Tum','Mere bachpan ka record dikhaiye.'],
            ['Dr. Arvind','Record mein kuch panne badle gaye hain. Main tumhe saboot dikha sakta hoon, lekin pehle clinic ke andar jo chhupaya gaya hai use dhoondho. Desk ka drawer band hai.'] ] },
          { type: 'inspect', obj: 'Clinic ke andar register, chaabi aur family photo investigate karo (0/3)', items: ['register','clinic_key','family_photo'], remind: ['Register ke saath desk aur deewar ke paas ki cheezein bhi check karo.'] },
          { type: 'talk', npc: 'arvind', obj: 'Dr. Arvind se family photo ka matlab poochho', lines: [
            ['Tum','Is photo mein jo bachcha hai… kya woh main hoon?'],
            ['Dr. Arvind','Haan. Us raat tumhari maa tumhe lekar clinic aayi thi. Tum baar-baar ek hi naam bol rahe the — Gopal.'],
            ['Tum','Gopal kaun tha?'],
            ['Dr. Arvind','Shyamlal ko dhoondho. Usne tower se us raat ki ghanti bajte dekhi thi.'] ] }
        ] },

      { id: 'q_shyamlal', npc: 'shyamlal', title: 'The Watchtower — Aakhri Ghanti', short: 'Laalten lekar tower par chadho aur ghanti ke nishaan dekho',
        locked: ['Doctor ne bheja hai? Pehle uska kaam poora karo.'],
        done: ['Ghanti paanch baar baji thi. Har baar ek naam mita diya gaya. Aakhri naam… tumhara tha. Chotu se milo. Usne wahi cheez drawing mein dekhi hai.'],
        stages: [
          { type: 'talk', npc: 'shyamlal', obj: 'Shyamlal se us raat ki ghanti ke baare mein poochho', lines: [
            ['Shyamlal','Tumhe tower tak aana hi tha. Us raat main yahin tha. Ghanti apne aap baji thi.'],
            ['Tum','Kisne bajayi?'],
            ['Shyamlal','Pata nahi. Laalten lo, seedhiyan chadho aur ghanti ke neeche bane nishaan dekho. Shayad tumhe samajh aaye.'] ] },
          { type: 'inspect', obj: 'Purani laalten aur ghanti ke nishaan investigate karo (0/2)', items: ['lantern','bell_clue'], remind: ['Laalten ke bina andhera hoga. Tower ke top deck par ghanti ke paas nishaan dekho.'] },
          { type: 'reach', obj: 'Watchtower ke top deck par jao', where: 'tower' },
          { type: 'talk', npc: 'shyamlal', obj: 'Shyamlal se paanch nishaanon ka matlab poochho', lines: [
            ['Tum','Deewar par paanch nishaan hain. Ek naam ke liye ek nishaan.'],
            ['Shyamlal','Paanch log… aur ek bachcha. Tum us raat wahan the. Main tumhe gate ke paas dekha tha.'],
            ['Tum','Mujhe kuch yaad kyun nahi?'],
            ['Shyamlal','Chotu ki drawings dekho. Shayad tumhara dimaag woh yaad wapas la sake.'] ] }
        ] },

      { id: 'q_chotu', npc: 'chotu', title: 'The Child in the Drawing — Pehchaan', short: 'School ke clues se apne bachpan ka raaz jaano',
        locked: ['Mujhe darr lag raha hai. Pehle Shyamlal se baat kar lo.'],
        done: ['Maine tumhe drawing mein dekha tha. Tum wapas aa gaye… par woh bhi tumhare peeche aa gayi.'],
        stages: [
          { type: 'talk', npc: 'chotu', obj: 'Chotu se uski drawings ke baare mein poochho', lines: [
            ['Chotu','Aap wahi ho na jo mere sapne mein aate ho?'],
            ['Tum','Tumne mujhe pehle dekha hai?'],
            ['Chotu','Nahi… par meri drawing mein aap ho. School mein mera bag aur drawing book chhoot gaye. Wahan jao. Lekin agar koi tumhara naam le, mudna mat.'] ] },
          { type: 'inspect', obj: 'School mein drawing book aur bag investigate karo (0/3)', items: ['drawing','school_bag','child_drawing'], remind: ['School ke aangan ko dhyan se dekho. Drawing book ke saath bag aur doosri drawing bhi hai.'] },
          { type: 'talk', npc: 'chotu', obj: 'Chotu ko drawing mein bane bachche ke baare mein poochho', lines: [
            ['Tum','Drawing mein jo bachcha hai… woh main hoon?'],
            ['Chotu','Haan. Aur aapke peeche jo khada hai, woh har drawing mein alag jagah aa jaata hai.'],
            ['Tum','SAAYA…'],
            ['Chotu','Usne mujhe bhi dekha tha. Usne kaha tha ki aapko sab yaad dilana hai.'] ] }
        ],
        onDone: [['', 'Drawing ke peeche ek purani tareekh likhi hai — wahi raat, 18 saal pehle.'], ['Tum','Main us raat gaon mein tha. Meri maa mujhe lekar bhaagi thi. Aur SAAYA mujhe tab se jaanti hai.'], ['','Door gaon ke gate par ek parchai khadi hai. Woh hilti nahi… bas tumhari taraf dekh rahi hai.'], ['Tum','Ab mujhe apne purane ghar jaana hoga.']]
      }
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
