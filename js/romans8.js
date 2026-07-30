const ROMANS8 = {
1:"Metii naa taata enkiguana te lelo ootii atua Kristo Yesu.",
2:"Amu aatalakutua nanu nkitanapat e Nkiyang'et e nkishui natii atua Kristo Yesu aaitung'uaa nkitanapat oo ng'ok o keeya.",
3:"Amu Enkai nataasa ina natalaikinote nkitanapat, to lbae le nchalan o sesen aataas. Eirriwua Enkai Oinoti lenye te mpukunoto o sesen loo ng'ok tiatua osesen.",
4:"pee etumi aaitabai nena sipat naajo nkitanapat tiatua iyiook; ilemerubare mbaa o sesen kake kirubare Enkiyang'et."
};
function verseForDay(day){
  if(day<=39) return {reference:`Romans 8:${day}`, verse:day, text:ROMANS8[day]||"Verse text will be added."};
  const reviewRanges={40:"Romans 8:1–5 Review",41:"Romans 8:6–10 Review",42:"Romans 8:11–15 Review",43:"Romans 8:16–20 Review",44:"Romans 8:21–25 Review",45:"Romans 8:26–30 Review",46:"Romans 8:31–34 Review",47:"Romans 8:35–39 Review",48:"Romans 8:1–20 Review",49:"Romans 8:21–39 Review",50:"Romans 8 Full Chapter"};
  return {reference:reviewRanges[day],verse:39,text:"Review day. Recite the assigned section without looking at the text."};
}