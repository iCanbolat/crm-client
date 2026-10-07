import type { LocationValue } from "../../api/reference.schemas"

/**
 * Reference sample of UN/LOCODE seaports, IATA airports and inland cities
 * (B3.2). Compact `CODE|Name|Country` rows keep the table readable.
 */

const PORTS = `
TRIST|İstanbul (Ambarlı)|TR
TRAMB|Ambarlı|TR
TRMER|Mersin|TR
TRIZM|İzmir|TR
TRALI|Aliağa|TR
TRGEM|Gemlik|TR
TRDRC|Derince|TR
TRISK|İskenderun|TR
TRSSX|Samsun|TR
TRTZX|Trabzon|TR
TRTEK|Tekirdağ|TR
TRYAR|Yarımca|TR
TRBDM|Bandırma|TR
DEHAM|Hamburg|DE
DEBRV|Bremerhaven|DE
DEWVN|Wilhelmshaven|DE
NLRTM|Rotterdam|NL
NLAMS|Amsterdam|NL
BEANR|Antwerp|BE
BEZEE|Zeebrugge|BE
FRLEH|Le Havre|FR
FRMRS|Marseille|FR
FRFOS|Fos-sur-Mer|FR
GBFXT|Felixstowe|GB
GBSOU|Southampton|GB
GBLGP|London Gateway|GB
GBLIV|Liverpool|GB
ESVLC|Valencia|ES
ESBCN|Barcelona|ES
ESALG|Algeciras|ES
PTSIE|Sines|PT
PTLIS|Lisbon|PT
ITGOA|Genoa|IT
ITSPE|La Spezia|IT
ITGIT|Gioia Tauro|IT
ITTRS|Trieste|IT
ITVCE|Venice|IT
ITNAP|Naples|IT
SIKOP|Koper|SI
HRRJK|Rijeka|HR
GRPIR|Piraeus|GR
GRSKG|Thessaloniki|GR
BGVAR|Varna|BG
BGBOJ|Burgas|BG
ROCND|Constanța|RO
UAODS|Odesa|UA
GEPTI|Poti|GE
GEBUS|Batumi|GE
RUNVS|Novorossiysk|RU
RULED|Saint Petersburg|RU
PLGDN|Gdańsk|PL
PLGDY|Gdynia|PL
SEGOT|Gothenburg|SE
DKAAR|Aarhus|DK
FIHEL|Helsinki|FI
NOOSL|Oslo|NO
LTKLJ|Klaipėda|LT
LVRIX|Riga|LV
EETLL|Tallinn|EE
MTMAR|Marsaxlokk|MT
CYLMS|Limassol|CY
ILHFA|Haifa|IL
ILASH|Ashdod|IL
LBBEY|Beirut|LB
EGPSD|Port Said|EG
EGALY|Alexandria|EG
EGDAM|Damietta|EG
MACAS|Casablanca|MA
MAPTM|Tanger Med|MA
DZALG|Algiers|DZ
TNTUN|Tunis (Radès)|TN
LYTIP|Tripoli|LY
AEJEA|Jebel Ali|AE
AEAUH|Abu Dhabi (Khalifa)|AE
SAJED|Jeddah|SA
SADMM|Dammam|SA
OMSOH|Sohar|OM
OMSLL|Salalah|OM
QAHMD|Hamad|QA
KWSWK|Shuwaikh|KW
IQUQR|Umm Qasr|IQ
IRBND|Bandar Abbas|IR
INNSA|Nhava Sheva|IN
INMUN|Mundra|IN
INMAA|Chennai|IN
PKKHI|Karachi|PK
LKCMB|Colombo|LK
BDCGP|Chittagong|BD
SGSIN|Singapore|SG
MYPKG|Port Klang|MY
MYTPP|Tanjung Pelepas|MY
THLCH|Laem Chabang|TH
VNSGN|Ho Chi Minh City|VN
VNHPH|Hai Phong|VN
IDJKT|Jakarta (Tanjung Priok)|ID
IDSUB|Surabaya|ID
PHMNL|Manila|PH
CNSHA|Shanghai|CN
CNNGB|Ningbo|CN
CNSZX|Shenzhen|CN
CNYTN|Yantian|CN
CNCAN|Guangzhou|CN
CNTAO|Qingdao|CN
CNTXG|Tianjin (Xingang)|CN
CNXMN|Xiamen|CN
CNDLC|Dalian|CN
HKHKG|Hong Kong|HK
TWKHH|Kaohsiung|TW
KRPUS|Busan|KR
KRINC|Incheon|KR
JPTYO|Tokyo|JP
JPYOK|Yokohama|JP
JPUKB|Kobe|JP
JPNGO|Nagoya|JP
AUSYD|Sydney|AU
AUMEL|Melbourne|AU
NZAKL|Auckland|NZ
USNYC|New York|US
USSAV|Savannah|US
USHOU|Houston|US
USLAX|Los Angeles|US
USLGB|Long Beach|US
USOAK|Oakland|US
USSEA|Seattle|US
USCHS|Charleston|US
USMIA|Miami|US
USNOL|New Orleans|US
CAMTR|Montreal|CA
CAVAN|Vancouver|CA
CAHAL|Halifax|CA
MXVER|Veracruz|MX
MXZLO|Manzanillo|MX
PAPTY|Panama (Balboa)|PA
COCTG|Cartagena|CO
BRSSZ|Santos|BR
BRRIG|Rio Grande|BR
BRPNG|Paranaguá|BR
ARBUE|Buenos Aires|AR
CLSAI|San Antonio|CL
CLVAP|Valparaíso|CL
PECLL|Callao|PE
ZADUR|Durban|ZA
ZACPT|Cape Town|ZA
NGAPP|Lagos (Apapa)|NG
GHTEM|Tema|GH
KEMBA|Mombasa|KE
TZDAR|Dar es Salaam|TZ
DJJIB|Djibouti|DJ
SNDKR|Dakar|SN
CIABJ|Abidjan|CI
`

const AIRPORTS = `
IST|İstanbul Havalimanı|TR
SAW|İstanbul Sabiha Gökçen|TR
ESB|Ankara Esenboğa|TR
ADB|İzmir Adnan Menderes|TR
AYT|Antalya|TR
ADA|Adana|TR
FRA|Frankfurt|DE
MUC|Munich|DE
LEJ|Leipzig/Halle|DE
CGN|Cologne Bonn|DE
HAM|Hamburg|DE
AMS|Amsterdam Schiphol|NL
LGG|Liège|BE
BRU|Brussels|BE
CDG|Paris Charles de Gaulle|FR
LHR|London Heathrow|GB
MAN|Manchester|GB
MAD|Madrid|ES
BCN|Barcelona|ES
MXP|Milan Malpensa|IT
FCO|Rome Fiumicino|IT
VIE|Vienna|AT
ZRH|Zurich|CH
WAW|Warsaw|PL
PRG|Prague|CZ
BUD|Budapest|HU
OTP|Bucharest|RO
SOF|Sofia|BG
ATH|Athens|GR
CPH|Copenhagen|DK
ARN|Stockholm Arlanda|SE
HEL|Helsinki|FI
SVO|Moscow Sheremetyevo|RU
TBS|Tbilisi|GE
GYD|Baku|AZ
TAS|Tashkent|UZ
ALA|Almaty|KZ
DXB|Dubai|AE
DWC|Dubai World Central|AE
DOH|Doha|QA
RUH|Riyadh|SA
JED|Jeddah|SA
CAI|Cairo|EG
TLV|Tel Aviv|IL
TUN|Tunis|TN
CMN|Casablanca|MA
LOS|Lagos|NG
NBO|Nairobi|KE
ADD|Addis Ababa|ET
JNB|Johannesburg|ZA
BOM|Mumbai|IN
DEL|Delhi|IN
SIN|Singapore Changi|SG
BKK|Bangkok|TH
KUL|Kuala Lumpur|MY
HKG|Hong Kong|HK
PVG|Shanghai Pudong|CN
PEK|Beijing Capital|CN
CAN|Guangzhou|CN
SZX|Shenzhen|CN
ICN|Seoul Incheon|KR
NRT|Tokyo Narita|JP
TPE|Taipei|TW
SYD|Sydney|AU
JFK|New York JFK|US
ORD|Chicago O'Hare|US
ATL|Atlanta|US
MIA|Miami|US
LAX|Los Angeles|US
YYZ|Toronto|CA
MEX|Mexico City|MX
GRU|São Paulo|BR
`

const CITIES = `
TRBUR|Bursa|TR
TRKCO|Kocaeli|TR
TRANK|Ankara|TR
TRGZT|Gaziantep|TR
TRKYA|Konya|TR
TRDNZ|Denizli|TR
TRKAY|Kayseri|TR
TRMAN|Manisa|TR
TRCOR|Çorlu|TR
DEDUS|Düsseldorf|DE
DESTR|Stuttgart|DE
DEBER|Berlin|DE
DEDUI|Duisburg|DE
ITMIL|Milan|IT
FRLYS|Lyon|FR
PLLOD|Łódź|PL
CZPRG|Prague|CZ
HUBUD|Budapest|HU
ATVIE|Vienna|AT
NLVEN|Venlo|NL
BGSOF|Sofia|BG
ROBUH|Bucharest|RO
IQEBL|Erbil|IQ
`

function parse(rows: string, kind: LocationValue["kind"]): LocationValue[] {
  return rows
    .trim()
    .split("\n")
    .map((line) => {
      const [code = "", name = "", country = ""] = line.split("|")
      return { code, name, country, kind }
    })
}

export const PORTS_DATA = parse(PORTS, "port")
export const AIRPORTS_DATA = parse(AIRPORTS, "airport")
export const CITIES_DATA = parse(CITIES, "city")

export const LOCATIONS: LocationValue[] = [
  ...PORTS_DATA,
  ...AIRPORTS_DATA,
  ...CITIES_DATA,
]

export function findLocation(code: string) {
  return LOCATIONS.find((location) => location.code === code)
}

/** Lookup that fails loudly in seed code (typos in fixed codes). */
export function location(code: string): LocationValue {
  const found = findLocation(code)
  if (!found) throw new Error(`[forwarding mocks] unknown location ${code}`)
  return found
}
