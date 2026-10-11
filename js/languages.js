// Languages spoken where ships call, and a few words in each.
// Each phrase is [as written, how to say it]. Pronunciations are rough English
// spellings (capitals mark the stressed part), meant to be understood rather
// than perfect.

export const TERMS = ['Hello', 'Thank you', 'Please', 'Welcome', 'Goodbye', 'Yes', 'No', 'Sorry'];

export const PHRASES = {
  es: [['Hola', 'OH-lah'], ['Gracias', 'GRAH-syahs'], ['Por favor', 'por fah-BOR'], ['Bienvenido', 'byen-beh-NEE-doh'], ['Adiós', 'ah-DYOS'], ['Sí', 'see'], ['No', 'noh'], ['Perdón', 'pehr-DOHN']],
  pt: [['Olá', 'oh-LAH'], ['Obrigado (said by a man) / Obrigada (by a woman)', 'oh-bree-GAH-doo / oh-bree-GAH-dah'], ['Por favor', 'por fah-VOR'], ['Bem-vindo', 'beng-VEEN-doo'], ['Tchau / Adeus', 'chow / ah-DAY-oosh'], ['Sim', 'seeng'], ['Não', 'nowng'], ['Desculpe', 'desh-KOOL-peh']],
  fr: [['Bonjour', 'bohn-ZHOOR'], ['Merci', 'mehr-SEE'], ["S'il vous plaît", 'seel voo PLEH'], ['Bienvenue', 'byan-vuh-NOO'], ['Au revoir', 'oh ruh-VWAHR'], ['Oui', 'wee'], ['Non', 'nohn'], ['Pardon', 'par-DOHN']],
  ar: [['السلام عليكم', 'as-sa-LAA-mu a-LAY-kum'], ['شكرا', 'SHOOK-ran'], ['من فضلك', 'min FAD-lak'], ['أهلا وسهلا', 'AH-lan wa SAH-lan'], ['مع السلامة', 'MA-a sa-LAA-ma'], ['نعم', 'NA-am'], ['لا', 'laa'], ['آسف', 'AA-sif']],
  zh: [['你好', 'nee how'], ['谢谢', 'shyeh-shyeh'], ['请', 'ching'], ['欢迎', 'hwahn-ying'], ['再见', 'dzai-jyen'], ['是的', 'shr duh'], ['不是', 'boo shr'], ['对不起', 'dway-boo-chee']],
  'zh-Hant': [['你好', 'nee how'], ['謝謝', 'shyeh-shyeh'], ['請', 'ching'], ['歡迎', 'hwahn-ying'], ['再見', 'dzai-jyen'], ['是的', 'shr duh'], ['不是', 'boo shr'], ['對不起', 'dway-boo-chee']],
  yue: [['你好', 'nay ho'], ['多謝', 'daw-jeh'], ['唔該', 'm-goy'], ['歡迎', 'foon-ying'], ['拜拜', 'bye-bye'], ['係', 'hai'], ['唔係', 'm-hai'], ['對唔住', 'doy m-joo']],
  ja: [['こんにちは', 'kon-nee-chee-wah'], ['ありがとう', 'ah-ree-GAH-toh'], ['お願いします', 'oh-neh-guy-shee-mahss'], ['ようこそ', 'YOH-koh-soh'], ['さようなら', 'sah-YOH-nah-rah'], ['はい', 'hi'], ['いいえ', 'ee-eh'], ['すみません', 'soo-mee-mah-sen']],
  ko: [['안녕하세요', 'ahn-nyong-ha-seh-yo'], ['감사합니다', 'kahm-sah-hahm-nee-dah'], ['주세요', 'joo-seh-yo'], ['환영합니다', 'hwan-yong-hahm-nee-dah'], ['안녕히 계세요', 'ahn-nyong-hee gyeh-seh-yo'], ['네', 'neh'], ['아니요', 'ah-nee-yo'], ['죄송합니다', 'chweh-song-hahm-nee-dah']],
  hi: [['नमस्ते', 'nuh-muh-STAY'], ['धन्यवाद', 'DHUN-yuh-vaad'], ['कृपया', 'KRIP-yah'], ['स्वागत है', 'SWAH-gut hai'], ['फिर मिलेंगे', 'phir mi-LEN-gay'], ['हाँ', 'haan'], ['नहीं', 'nuh-HEE'], ['माफ़ कीजिए', 'maaf KEE-jee-yay']],
  bn: [['আসসালামু আলাইকুম', 'as-sa-LAA-mu a-LAI-kum'], ['ধন্যবাদ', 'DHON-no-bad'], ['অনুগ্রহ করে', 'o-nu-gro-ho KO-re'], ['স্বাগতম', 'SHA-go-tom'], ['বিদায়', 'bee-DAI'], ['হ্যাঁ', 'hyan'], ['না', 'nah'], ['দুঃখিত', 'DOOK-khee-to']],
  ur: [['السلام علیکم', 'as-sa-LAAM a-LAI-kum'], ['شکریہ', 'SHOOK-ree-yah'], ['مہربانی', 'mehr-BAA-nee'], ['خوش آمدید', 'khush aam-DEED'], ['خدا حافظ', 'khu-DAA HAA-fiz'], ['جی ہاں', 'jee haan'], ['نہیں', 'nuh-HEE'], ['معاف کیجیے', 'maaf KEE-jee-yay']],
  si: [['ආයුබෝවන්', 'AH-yu-boh-wan'], ['ස්තූතියි', 'STOO-tee-yee'], ['කරුණාකර', 'ka-ru-NAA-ka-ra'], ['සාදරයෙන් පිළිගනිමු', 'SAA-da-ra-yen pi-li-ga-ni-mu'], ['ගිහින් එන්නම්', 'gi-hin EN-nam'], ['ඔව්', 'oh'], ['නැහැ', 'NEH-heh'], ['සමාවෙන්න', 'sa-MAA-wen-na']],
  ta: [['வணக்கம்', 'VA-nak-kam'], ['நன்றி', 'NUN-dree'], ['தயவுசெய்து', 'dha-ya-vu-SEY-dhu'], ['வரவேற்கிறோம்', 'va-ra-VER-ki-rom'], ['போய் வருகிறேன்', 'poy VA-ru-gi-ren'], ['ஆம்', 'aam'], ['இல்லை', 'IL-lai'], ['மன்னிக்கவும்', 'MUN-nik-ka-vum']],
  th: [['สวัสดี (ครับ/ค่ะ)', 'sa-wat-DEE (krap for men / ka for women)'], ['ขอบคุณ', 'kop KOON'], ['กรุณา', 'ga-ru-NAA'], ['ยินดีต้อนรับ', 'yin-dee TON-rap'], ['ลาก่อน', 'laa-GORN'], ['ใช่', 'chai'], ['ไม่ใช่', 'mai chai'], ['ขอโทษ', 'kor-TOHT']],
  vi: [['Xin chào', 'sin chow'], ['Cảm ơn', 'gahm uhn'], ['Làm ơn', 'lahm uhn'], ['Chào mừng', 'chow mung'], ['Tạm biệt', 'tahm bee-et'], ['Vâng', 'vung'], ['Không', 'khom'], ['Xin lỗi', 'sin loy']],
  ms: [['Apa khabar', 'AH-pa KHA-bar'], ['Terima kasih', 'te-REE-ma KA-seh'], ['Tolong', 'TOH-long'], ['Selamat datang', 'se-LA-mat DA-tang'], ['Selamat tinggal', 'se-LA-mat TING-gal'], ['Ya', 'yah'], ['Tidak', 'TEE-dak'], ['Maaf', 'MA-af']],
  id: [['Halo', 'HAH-loh'], ['Terima kasih', 'te-REE-ma KAH-see'], ['Tolong', 'TOH-long'], ['Selamat datang', 'se-LAH-mat DAH-tang'], ['Sampai jumpa', 'SAHM-pai JOOM-pah'], ['Ya', 'yah'], ['Tidak', 'TEE-dak'], ['Maaf', 'MAH-af']],
  tl: [['Kumusta', 'koo-MOOS-tah'], ['Salamat', 'sah-LAH-mat'], ['Pakiusap', 'pah-kee-OO-sap'], ['Maligayang pagdating', 'mah-lee-GAH-yang pag-DAH-ting'], ['Paalam', 'pah-AH-lam'], ['Oo', 'OH-oh'], ['Hindi', 'hin-DEE'], ['Pasensya na', 'pah-SEN-shah nah']],
  my: [['မင်္ဂလာပါ', 'min-ga-la-BAH'], ['ကျေးဇူးတင်ပါတယ်', 'jay-zoo tin-ba-DEH'], ['ကျေးဇူးပြု၍', 'jay-zoo pyu-YWAY'], ['ကြိုဆိုပါတယ်', 'joh-soh-ba-DEH'], ['သွားတော့မယ်', 'thwa-daw-MEH'], ['ဟုတ်ကဲ့', 'hoht-KEH'], ['မဟုတ်ဘူး', 'ma-hoht-BOO'], ['တောင်းပန်ပါတယ်', 'towng-ban-ba-DEH']],
  km: [['សួស្តី', 'soo-uh-s-DAY'], ['អរគុណ', 'aw-KOON'], ['សូម', 'sohm'], ['សូមស្វាគមន៍', 'sohm svaa-KUM'], ['លាហើយ', 'lee-uh HAOY'], ['បាទ (men) / ចាស (women)', 'baht / chah'], ['ទេ', 'tay'], ['សុំទោស', 'sohm TOHS']],
  ru: [['Здравствуйте', 'ZDRAST-vooy-tyeh'], ['Спасибо', 'spah-SEE-bah'], ['Пожалуйста', 'pah-ZHAH-loo-stah'], ['Добро пожаловать', 'dah-BRO pah-ZHAH-lah-vat'], ['До свидания', 'dah svee-DAH-nee-yah'], ['Да', 'dah'], ['Нет', 'nyet'], ['Извините', 'eez-vee-NEE-tyeh']],
  uk: [['Добрий день', 'DOH-bri den'], ['Дякую', 'DYAH-koo-yoo'], ['Будь ласка', 'bood LAH-skah'], ['Ласкаво просимо', 'lahs-KAH-vo PRO-si-mo'], ['До побачення', 'doh po-BAH-chen-nyah'], ['Так', 'tahk'], ['Ні', 'nee'], ['Вибачте', 'VI-bach-teh']],
  pl: [['Dzień dobry', 'jeyn DOH-brih'], ['Dziękuję', 'jen-KOO-yeh'], ['Proszę', 'PROH-sheh'], ['Witamy', 'vee-TAH-mih'], ['Do widzenia', 'doh vee-DZEH-nyah'], ['Tak', 'tahk'], ['Nie', 'nyeh'], ['Przepraszam', 'psheh-PRAH-sham']],
  de: [['Guten Tag', 'GOO-ten tahk'], ['Danke', 'DAHN-keh'], ['Bitte', 'BIT-teh'], ['Willkommen', 'vil-KOM-en'], ['Auf Wiedersehen', 'owf VEE-der-zayn'], ['Ja', 'yah'], ['Nein', 'nine'], ['Entschuldigung', 'ent-SHOOL-dee-goong']],
  nl: [['Hallo', 'HAH-loh'], ['Dank u wel', 'dahnk oo vel'], ['Alstublieft', 'AHL-stoo-bleeft'], ['Welkom', 'VEL-kom'], ['Tot ziens', 'tot zeens'], ['Ja', 'yah'], ['Nee', 'nay'], ['Sorry', 'SOR-ree']],
  da: [['Hej', 'hi'], ['Tak', 'tahk'], ['Vær så venlig', 'vair saw VEN-lee'], ['Velkommen', 'vel-KOM-en'], ['Farvel', 'far-VEL'], ['Ja', 'yah'], ['Nej', 'nai'], ['Undskyld', 'OON-skyool']],
  no: [['Hei', 'hi'], ['Takk', 'tahk'], ['Vær så snill', 'vair saw snil'], ['Velkommen', 'vel-KOM-men'], ['Ha det', 'HAH deh'], ['Ja', 'yah'], ['Nei', 'nai'], ['Unnskyld', 'OON-shil']],
  sv: [['Hej', 'hey'], ['Tack', 'tahk'], ['Snälla', 'SNEL-la'], ['Välkommen', 'VEL-kom-men'], ['Hej då', 'hey DOH'], ['Ja', 'yah'], ['Nej', 'nay'], ['Förlåt', 'fur-LOHT']],
  fi: [['Hei', 'hay'], ['Kiitos', 'KEE-tos'], ['Ole hyvä', 'OH-leh HUU-va'], ['Tervetuloa', 'TER-veh-tu-lo-ah'], ['Näkemiin', 'NA-ke-meen'], ['Kyllä', 'KUEL-la'], ['Ei', 'ay'], ['Anteeksi', 'AHN-tek-see']],
  is: [['Halló', 'HAL-loh'], ['Takk', 'tahk'], ['Gjörðu svo vel', 'GYUR-thu svo vel'], ['Velkomin', 'VEL-ko-min'], ['Bless', 'bless'], ['Já', 'yow'], ['Nei', 'nay'], ['Fyrirgefðu', 'FIR-ir-gev-thu']],
  et: [['Tere', 'TEH-reh'], ['Aitäh', 'AI-tah'], ['Palun', 'PAH-lun'], ['Tere tulemast', 'TEH-reh TU-le-mast'], ['Head aega', 'heh-ahd AH-eh-gah'], ['Jah', 'yah'], ['Ei', 'ay'], ['Vabandust', 'VAH-bahn-dust']],
  lv: [['Sveiki', 'SVAY-kee'], ['Paldies', 'PAHL-dee-es'], ['Lūdzu', 'LOO-dzoo'], ['Laipni lūdzam', 'LAIP-nee LOO-dzam'], ['Uz redzēšanos', 'ooz RED-zeh-shah-nwos'], ['Jā', 'yah'], ['Nē', 'neh'], ['Atvainojiet', 'AHT-vai-nwo-yee-et']],
  lt: [['Labas', 'LAH-bas'], ['Ačiū', 'AH-choo'], ['Prašau', 'prah-SHOW'], ['Sveiki atvykę', 'SVAY-kee aht-VEE-keh'], ['Viso gero', 'VEE-so GEH-ro'], ['Taip', 'taip'], ['Ne', 'neh'], ['Atsiprašau', 'aht-si-prah-SHOW']],
  it: [['Buongiorno', 'bwon-JOR-noh'], ['Grazie', 'GRAHT-see-eh'], ['Per favore', 'pehr fah-VOH-reh'], ['Benvenuto', 'ben-veh-NOO-toh'], ['Arrivederci', 'ah-ree-veh-DEHR-chee'], ['Sì', 'see'], ['No', 'noh'], ['Scusi', 'SKOO-zee']],
  el: [['Γεια σας', 'YAH sahs'], ['Ευχαριστώ', 'ef-hah-ree-STOH'], ['Παρακαλώ', 'pah-rah-kah-LOH'], ['Καλώς ήρθατε', 'kah-LOHS EER-tha-teh'], ['Αντίο', 'ahn-DEE-oh'], ['Ναι', 'neh'], ['Όχι', 'OH-hee'], ['Συγγνώμη', 'seeg-NOH-mee']],
  tr: [['Merhaba', 'MEHR-hah-bah'], ['Teşekkür ederim', 'teh-shek-KUER eh-deh-rim'], ['Lütfen', 'LUET-fen'], ['Hoş geldiniz', 'hosh GEL-di-niz'], ['Hoşça kalın', 'HOSH-cha kah-lun'], ['Evet', 'eh-VET'], ['Hayır', 'HAH-yur'], ['Özür dilerim', 'er-ZUER di-leh-rim']],
  hr: [['Dobar dan', 'DOH-bar dahn'], ['Hvala', 'HVAH-lah'], ['Molim', 'MOH-leem'], ['Dobrodošli', 'DOH-broh-dosh-lee'], ['Doviđenja', 'doh-vee-JEN-yah'], ['Da', 'dah'], ['Ne', 'neh'], ['Oprostite', 'oh-PROS-tee-teh']],
  sr: [['Здраво (Zdravo)', 'ZDRAH-voh'], ['Хвала (Hvala)', 'HVAH-lah'], ['Молим (Molim)', 'MOH-leem'], ['Добродошли (Dobrodošli)', 'DOH-broh-dosh-lee'], ['Довиђења (Doviđenja)', 'doh-vee-JEN-yah'], ['Да (Da)', 'dah'], ['Не (Ne)', 'neh'], ['Извините (Izvinite)', 'eez-VEE-nee-teh']],
  sl: [['Dober dan', 'DOH-ber dahn'], ['Hvala', 'HVAH-lah'], ['Prosim', 'PROH-seem'], ['Dobrodošli', 'doh-broh-DOHSH-lee'], ['Nasvidenje', 'nas-vee-DEN-yeh'], ['Ja', 'yah'], ['Ne', 'neh'], ['Oprostite', 'oh-PROS-tee-teh']],
  ro: [['Bună ziua', 'BOO-nuh ZEE-wah'], ['Mulțumesc', 'mool-tsoo-MESK'], ['Vă rog', 'vuh rohg'], ['Bun venit', 'boon veh-NEET'], ['La revedere', 'lah reh-veh-DEH-reh'], ['Da', 'dah'], ['Nu', 'noo'], ['Scuzați-mă', 'skoo-ZAHTS-muh']],
  bg: [['Здравейте', 'zdrah-VAY-teh'], ['Благодаря', 'blah-go-dah-RYAH'], ['Моля', 'MOH-lyah'], ['Добре дошли', 'DOB-reh dosh-LEE'], ['Довиждане', 'doh-VEEZH-dah-neh'], ['Да (a shake of the head)', 'dah'], ['Не (a nod)', 'neh'], ['Извинете', 'eez-vee-NEH-teh']],
  sq: [['Përshëndetje', 'per-shen-DET-yeh'], ['Faleminderit', 'fah-leh-meen-DEH-reet'], ['Ju lutem', 'yoo LOO-tem'], ['Mirë se vini', 'MEER-eh seh VEE-nee'], ['Mirupafshim', 'meer-oo-PAHF-sheem'], ['Po', 'poh'], ['Jo', 'yoh'], ['Më falni', 'muh FAHL-nee']],
  mt: [['Bonġu', 'BON-joo'], ['Grazzi', 'GRAHT-tsee'], ['Jekk jogħġbok', 'yek YOJ-bok'], ['Merħba', 'MEHR-ba'], ['Saħħa', 'SAH-hah'], ['Iva', 'EE-vah'], ['Le', 'leh'], ['Skużani', 'skoo-ZAH-nee']],
  he: [['שלום', 'shah-LOHM'], ['תודה', 'toh-DAH'], ['בבקשה', 'beh-vah-kah-SHAH'], ['ברוכים הבאים', 'broo-KHEEM hah-bah-EEM'], ['להתראות', 'leh-heet-rah-OHT'], ['כן', 'ken'], ['לא', 'loh'], ['סליחה', 'slee-KHAH']],
  fa: [['سلام', 'sah-LAAM'], ['ممنون', 'mam-NOON'], ['لطفا', 'LOT-fan'], ['خوش آمدید', 'khosh aa-ma-DEED'], ['خداحافظ', 'kho-DAA-haa-fez'], ['بله', 'BA-leh'], ['نه', 'nah'], ['ببخشید', 'be-bakh-SHEED']],
  sw: [['Habari', 'hah-BAH-ree'], ['Asante', 'ah-SAHN-teh'], ['Tafadhali', 'tah-fah-DHAH-lee'], ['Karibu', 'kah-REE-boo'], ['Kwaheri', 'kwah-HEH-ree'], ['Ndiyo', 'n-DEE-yoh'], ['Hapana', 'hah-PAH-nah'], ['Samahani', 'sah-mah-HAH-nee']],
  so: [['Iska warran', 'IS-ka WAR-ran'], ['Mahadsanid', 'ma-had-SA-nid'], ['Fadlan', 'FAD-lan'], ['Soo dhawoow', 'soh DHA-wow'], ['Nabad gelyo', 'NA-bad GEL-yo'], ['Haa', 'haa'], ['Maya', 'MAI-ya'], ['Iga raali ahow', 'I-ga RAA-li a-HOW']],
  mg: [['Manao ahoana', 'ma-NOW a-OH-na'], ['Misaotra', 'mee-SOH-tra'], ['Azafady', 'a-za-FAD'], ['Tonga soa', 'TOONG-ga SOO-a'], ['Veloma', 'veh-LOOM'], ['Eny', 'EN'], ['Tsia', 'TSEE'], ['Miala tsiny', 'mee-AH-la TSEEN']],
  zu: [['Sawubona', 'sah-woo-BOH-nah'], ['Ngiyabonga', 'ngee-yah-BOH-ngah'], ['Ngicela', 'ngee-CHEH-lah'], ['Siyakwamukela', 'see-yah-kwah-moo-KEH-lah'], ['Sala kahle', 'SAH-lah GAH-shleh'], ['Yebo', 'YEH-boh'], ['Cha', 'chah'], ['Uxolo', 'oo-KHOH-loh']],
  af: [['Hallo', 'HAH-loh'], ['Dankie', 'DUN-kee'], ['Asseblief', 'ah-suh-BLEEF'], ['Welkom', 'VEL-kom'], ['Totsiens', 'tot-SEENS'], ['Ja', 'yah'], ['Nee', 'nee-uh'], ['Jammer', 'YAM-mer']],
  yo: [['Ẹ n lẹ', 'eh n leh'], ['Ẹ ṣé', 'eh SHEH'], ['Jọ̀wọ́', 'JAW-waw'], ['Ẹ kú àbọ̀', 'eh koo AH-baw'], ['Ó dàbọ̀', 'oh DAH-baw'], ['Bẹ́ẹ̀ni', 'BEH-nee'], ['Rárá', 'RAH-rah'], ['Ẹ má bínú', 'eh mah BEE-noo']],
  ha: [['Sannu', 'SAN-noo'], ['Na gode', 'nah GOH-deh'], ['Don Allah', 'don AL-lah'], ['Barka da zuwa', 'BAR-kah dah ZOO-wah'], ['Sai an jima', 'sai an JEE-mah'], ['Ee', 'eh'], ["A'a", 'AH-ah'], ['Yi haƙuri', 'yee hah-KOO-ree']],
  ht: [['Bonjou', 'bohn-ZHOO'], ['Mèsi', 'meh-SEE'], ['Tanpri', 'tahn-PREE'], ['Byenvini', 'byen-vee-NEE'], ['Orevwa', 'oh-reh-VWAH'], ['Wi', 'wee'], ['Non', 'nohn'], ['Eskize m', 'es-kee-ZEH m']],
  ka: [['გამარჯობა', 'gah-mar-JOH-bah'], ['მადლობა', 'MAD-lo-bah'], ['გთხოვთ', 'g-TKHOVT'], ['კეთილი იყოს თქვენი მობრძანება', 'ke-TI-li i-KOS tkve-NI mob-rdza-NE-ba'], ['ნახვამდის', 'NAKH-vam-dis'], ['დიახ', 'dee-AKH'], ['არა', 'AH-rah'], ['ბოდიში', 'BOH-dee-shee']],
  az: [['Salam', 'sah-LAHM'], ['Təşəkkür edirəm', 'teh-shek-KUER eh-dee-rem'], ['Zəhmət olmasa', 'zeh-MET ol-ma-SA'], ['Xoş gəlmisiniz', 'khosh gel-MEE-see-niz'], ['Sağ olun', 'sagh OH-loon'], ['Bəli', 'BEH-lee'], ['Xeyr', 'khayr'], ['Bağışlayın', 'ba-ghush-LA-yun']],
  hu: [['Jó napot', 'yoh NAH-pot'], ['Köszönöm', 'KUH-suh-num'], ['Kérem', 'KAY-rem'], ['Üdvözöljük', 'UED-vuh-zuhl-yuek'], ['Viszontlátásra', 'VEE-sont-lah-tash-rah'], ['Igen', 'EE-gen'], ['Nem', 'nem'], ['Elnézést', 'EL-nay-zaysht']],
  cs: [['Dobrý den', 'DOH-bree den'], ['Děkuji', 'DYEH-koo-yee'], ['Prosím', 'PROH-seem'], ['Vítejte', 'VEE-tay-teh'], ['Na shledanou', 'nah SKHLEH-dah-noh'], ['Ano', 'AH-noh'], ['Ne', 'neh'], ['Promiňte', 'PROH-min-teh']],
  sk: [['Dobrý deň', 'DOH-bree dyen'], ['Ďakujem', 'DYAH-koo-yem'], ['Prosím', 'PROH-seem'], ['Vitajte', 'VEE-tai-teh'], ['Dovidenia', 'DOH-vee-deh-nyah'], ['Áno', 'AH-noh'], ['Nie', 'nyeh'], ['Prepáčte', 'PREH-pahch-teh']],
  fj: [['Bula', 'MBOO-lah'], ['Vinaka', 'vee-NAH-kah'], ['Yalo vinaka', 'YAH-loh vee-NAH-kah'], ['Bula vinaka', 'MBOO-lah vee-NAH-kah'], ['Moce', 'MOH-theh'], ['Io', 'EE-oh'], ['Sega', 'SENG-ah'], ['Vosoti au', 'voh-SOH-tee ow']],
  sm: [['Talofa', 'tah-LOH-fah'], ["Fa'afetai", 'fah-ah-feh-TAI'], ["Fa'amolemole", 'fah-ah-moh-leh-MOH-leh'], ['Afio mai', 'ah-FEE-oh mai'], ['Tofa', 'TOH-fah'], ['Ioe', 'ee-OH-eh'], ['Leai', 'leh-AI'], ["Fa'amalie atu", 'fah-ah-mah-LEE-eh AH-too']],
  to: [['Mālō e lelei', 'MAH-loh eh leh-LAY'], ['Mālō', 'MAH-loh'], ['Kātaki', 'KAH-tah-kee'], ['Talitali fiefia', 'tah-lee-TAH-lee fee-eh-FEE-ah'], ['Nofo ā', 'NOH-foh ah'], ['Io', 'EE-oh'], ["'Ikai", 'ee-KAI'], ['Fakamolemole', 'fah-kah-moh-leh-MOH-leh']],
  tpi: [['Gude', 'goo-DAY'], ['Tenkyu', 'TENK-yoo'], ['Plis', 'plees'], ['Welkam', 'WEL-kahm'], ['Lukim yu', 'LOO-kim yoo'], ['Yes', 'yes'], ['Nogat', 'NO-gat'], ['Sori', 'SOR-ree']],
};
// Bosnian and Montenegrin share these words with Croatian and Serbian.
PHRASES.bs = PHRASES.hr;

// The main languages of each country: the first is the one most spoken.
export const LANGUAGES = {
  // East and south-east Asia
  CN: ['zh'], TW: ['zh-Hant'], HK: ['yue', 'en'], MO: ['yue', 'pt'], JP: ['ja'], KR: ['ko'], KP: ['ko'],
  VN: ['vi'], TH: ['th'], KH: ['km'], MM: ['my'], MY: ['ms', 'en', 'zh'], BN: ['ms'], SG: ['en', 'zh', 'ms', 'ta'],
  ID: ['id'], PH: ['tl', 'en'], TL: ['pt'],
  // South Asia
  IN: ['hi', 'en'], PK: ['ur', 'en'], BD: ['bn'], LK: ['si', 'ta'], MV: ['en'],
  // Middle East
  AE: ['ar', 'en'], SA: ['ar'], OM: ['ar'], QA: ['ar'], KW: ['ar'], BH: ['ar'], IQ: ['ar'], YE: ['ar'],
  JO: ['ar'], LB: ['ar', 'fr'], SY: ['ar'], IL: ['he', 'ar'], IR: ['fa'], AF: ['fa'], TR: ['tr'], CY: ['el', 'tr'],
  GE: ['ka'], AZ: ['az'], KZ: ['ru'], TM: ['ru'],
  // Europe
  GB: ['en'], IE: ['en'], IM: ['en'], JE: ['en'], GG: ['en'], GI: ['en', 'es'], FR: ['fr'], MC: ['fr'],
  BE: ['nl', 'fr'], NL: ['nl'], LU: ['fr', 'de'], DE: ['de'], AT: ['de'], CH: ['de', 'fr', 'it'],
  DK: ['da'], FO: ['da'], GL: ['da'], NO: ['no'], SJ: ['no'], SE: ['sv'], AX: ['sv'], FI: ['fi', 'sv'], IS: ['is'],
  EE: ['et'], LV: ['lv'], LT: ['lt'], PL: ['pl'], CZ: ['cs'], SK: ['sk'], HU: ['hu'],
  ES: ['es'], PT: ['pt'], IT: ['it'], SM: ['it'], MT: ['mt', 'en'], GR: ['el'], AL: ['sq'],
  HR: ['hr'], SI: ['sl'], BA: ['bs'], ME: ['sr'], RS: ['sr'], RO: ['ro'], MD: ['ro'], BG: ['bg'],
  UA: ['uk'], RU: ['ru'], BY: ['ru'],
  // Africa
  EG: ['ar'], LY: ['ar'], TN: ['ar', 'fr'], DZ: ['ar', 'fr'], MA: ['ar', 'fr'], EH: ['ar'], MR: ['ar', 'fr'],
  SD: ['ar'], ER: ['ar', 'en'], DJ: ['fr', 'ar'], SO: ['so', 'ar'], KM: ['fr', 'ar'],
  KE: ['sw', 'en'], TZ: ['sw', 'en'], UG: ['en', 'sw'], MZ: ['pt'], MG: ['mg', 'fr'], MU: ['en', 'fr'],
  SC: ['en', 'fr'], RE: ['fr'], YT: ['fr'], ZA: ['en', 'zu', 'af'], NA: ['en', 'af'], AO: ['pt'],
  CD: ['fr'], CG: ['fr'], GA: ['fr'], GQ: ['es', 'fr'], CM: ['fr', 'en'], NG: ['en', 'yo', 'ha'],
  BJ: ['fr'], TG: ['fr'], GH: ['en'], CI: ['fr'], LR: ['en'], SL: ['en'], GN: ['fr'], GW: ['pt'],
  SN: ['fr'], GM: ['en'], CV: ['pt'], ST: ['pt'], SH: ['en'], BI: ['fr'], RW: ['en'], MW: ['en'],
  ZM: ['en'], ZW: ['en'], BF: ['fr'], BW: ['en'], SZ: ['en'],
  // Americas
  US: ['en'], CA: ['en', 'fr'], MX: ['es'], GT: ['es'], BZ: ['en'], HN: ['es'], SV: ['es'], NI: ['es'],
  CR: ['es'], PA: ['es'], CO: ['es'], VE: ['es'], EC: ['es'], PE: ['es'], CL: ['es'], AR: ['es'],
  UY: ['es'], PY: ['es'], BO: ['es'], BR: ['pt'], GY: ['en'], SR: ['nl'], GF: ['fr'], FK: ['en'],
  CU: ['es'], DO: ['es'], PR: ['es', 'en'], HT: ['ht', 'fr'], JM: ['en'], BS: ['en'], TT: ['en'],
  BB: ['en'], AG: ['en'], DM: ['en'], GD: ['en'], KN: ['en'], LC: ['en'], VC: ['en'], MS: ['en'],
  AI: ['en'], VG: ['en'], VI: ['en'], KY: ['en'], TC: ['en'], BM: ['en'], GP: ['fr'], MQ: ['fr'],
  BL: ['fr'], MF: ['fr'], PM: ['fr'], SX: ['nl', 'en'], CW: ['nl'], AW: ['nl'], BQ: ['nl'],
  // Oceania
  AU: ['en'], NZ: ['en'], PG: ['en', 'tpi'], FJ: ['en', 'fj'], NC: ['fr'], PF: ['fr'], WF: ['fr'],
  WS: ['sm', 'en'], AS: ['en', 'sm'], TO: ['to', 'en'], VU: ['en', 'fr'], SB: ['en'], KI: ['en'],
  TV: ['en'], NR: ['en'], FM: ['en'], MH: ['en'], PW: ['en'], GU: ['en'], MP: ['en'], CK: ['en'],
  NU: ['en'], TK: ['en'], NF: ['en'], CX: ['en'], CC: ['en'], IO: ['en'],
};

const languageNames = (() => {
  try { return new Intl.DisplayNames(['en'], { type: 'language' }); } catch { return null; }
})();
const OWN_NAMES = { 'zh-Hant': 'Chinese (Mandarin, traditional script)', zh: 'Chinese (Mandarin)', yue: 'Cantonese', tpi: 'Tok Pisin', no: 'Norwegian' };
export function languageName(code) {
  if (OWN_NAMES[code]) return OWN_NAMES[code];
  try { return languageNames?.of(code) || code; } catch { return code; }
}
