/* THE LAST VILLAGE — final chapter quest data. Loaded before p2-story.js. */
(function(){
 'use strict'; const P2=window.P2; if(!P2||!P2.config) return; const C=P2.config;
 C.items.final_key={x:1.8,z:15.2,snap:true,model:'letter',verb:'🗝️ Car ki chaabi uthao',speaker:'Tum',read:[['','Raghunath ki purani chaabi. Saath mein ek note hai: “Ab faisla tumhara hai.”'],['Tum','Car ab chal sakti hai. Lekin pehle mujhe tay karna hoga ki is gaon ke saath kya karna hai.']]};
 C.quests.push(
 {id:'q_graveyard_final',npc:'shyamlal',title:'The Forgotten Grave — Bhule Hue Naam',short:'Graveyard mein chhupi kabr aur naam investigate karo',locked:['Pehle Chotu ki drawings ka raaz samajh lo.'],done:['Maine tumhe bachane ki koshish ki thi. Dev ke paas Mohan ki diary hai. Usse milo.'],stages:[
  {type:'reach',where:'graveyard',obj:'Purane graveyard ke andar jao'},
  {type:'inspect',obj:'Chhupi kabr aur teen naam wale patthar investigate karo (0/4)',items:['hidden_grave','name_stone1','name_stone2','name_stone3'],remind:['Kabr aur aas-paas ke teen patthar dhyan se dekho.']},
 ],onDone:[['Tum','Hari Prasad, Savitri, Lakshmi, Baldev, Munna… aur Gopal. Sab yahin dafn hain.'],['','Ek purani yaad laut aati hai: Gopal tumhara bhai tha. Us raat usne tumhe bachaya tha.'],['Tum','Dev ko dhoondhna hoga. Mohan ki diary mein baaki sach hai.']]},
 {id:'q_dev_truth',npc:'dev',title:'The Missing Villager — Mohan ki Diary',short:'Dev ko dhoondho aur Mohan ke aakhri nishaan follow karo',locked:['Kamla ne jo kaha, usse pehle graveyard ka kaam poora karo.'],done:['Ab tum sach jaante ho. Lekin SAAYA ab tumhe jaane nahi degi. Raghunath ke paas car ki chaabi hai.'],stages:[
  {type:'talk',npc:'dev',obj:'Dev se Mohan aur diary ke baare mein poochho',lines:[['Dev','Tum graveyard tak pahunch gaye… toh ab tumhe rokna mushkil hai. Mohan mera bhai tha. Woh us raat sach dhoondhne gaya aur kabhi wapas nahi aaya.'],['Tum','Uski diary tumhare paas hai?'],['Dev','Teen panne gaon mein chhupaye the. Unhe dhoondho. Aakhri nishaan jungle ke kinaare milega.']]},
  {type:'inspect',obj:'Mohan ki diary ke teen panne aur coat investigate karo (0/4)',items:['diary1','diary2','diary3','mohan_coat'],remind:['Diary ke teen panne aur jungle ke kinaare pada Mohan ka coat dhoondho.']},
  {type:'talk',npc:'dev',obj:'Dev ko diary ke saboot dikhao',lines:[['Tum','Mohan ko SAAYA ne nahi uthaya tha. Woh us raat ke logon ko bachane ki koshish kar raha tha.'],['Dev','Mohan ko pata chal gaya tha ki gaon ke kuch logon ne tragedy ko chhupane ke liye records badle. SAAYA un logon ki yaadon aur darr se bani… ya shayad kuch aur hai.'],['Tum','Aur Gopal?'],['Dev','Gopal ne tumhe bachane ke liye khud ko peeche chhod diya. Ab tumhare paas faisla karne ka waqt hai.']]}
 ]},
 {id:'q_final_car',npc:'raghunath',title:'The Last Ride — Aakhri Faisla',short:'Raghunath se car ki chaabi lo aur gaon se nikalne ki taiyari karo',locked:['Dev se sach jaan kar aao.'],done:['Jo bhi faisla kiya, ab usse badla nahi ja sakta.'],stages:[
  {type:'collect',obj:'Raghunath ki car ki chaabi dhoondho',items:['final_key'],remind:['Raghunath ki workshop ke paas chaabi dhoondho.']},
 ]}
 );
})();
