// Learn: classification societies and class surveys, and a ship's
// certificates under the UK flag (Maritime and Coastguard Agency). For study:
// validity and what each is for, not dates. The conventions, the MCA's
// Merchant Shipping Notices (MSNs) and Marine Guidance Notes (MGNs), and the
// class rules are the authority.

// ----------------------------------------------------------------- class
export const SOCIETIES = [
  // [name, short, country, founded, note]
  ['Lloyd’s Register', 'LR', 'United Kingdom', 1760, 'The oldest; started at Edward Lloyd’s coffee house in London. Also an MCA Recognised Organisation.'],
  ['Bureau Veritas', 'BV', 'France', 1828, 'Founded in Antwerp, now Paris-based. MCA Recognised Organisation.'],
  ['Registro Italiano Navale', 'RINA', 'Italy', 1861, 'Genoa. MCA Recognised Organisation.'],
  ['American Bureau of Shipping', 'ABS', 'United States', 1862, 'Houston. MCA Recognised Organisation.'],
  ['DNV', 'DNV', 'Norway', 1864, 'Det Norske Veritas, merged with Germanischer Lloyd (GL, Germany) in 2013. MCA Recognised Organisation.'],
  ['Nippon Kaiji Kyokai (ClassNK)', 'NK', 'Japan', 1899, 'Tokyo. MCA Recognised Organisation.'],
  ['Polish Register of Shipping', 'PRS', 'Poland', 1936, 'Gdańsk.'],
  ['Croatian Register of Shipping', 'CRS', 'Croatia', 1949, 'Split.'],
  ['China Classification Society', 'CCS', 'China', 1956, 'Beijing.'],
  ['Korean Register', 'KR', 'South Korea', 1960, 'Busan. MCA Recognised Organisation.'],
  ['Türk Loydu', 'TL', 'Turkey', 1962, 'Istanbul.'],
  ['Indian Register of Shipping', 'IRS', 'India', 1975, 'Mumbai.'],
];
export const OTHER_SOCIETIES = [
  ['Russian Maritime Register of Shipping', 'RS', 'Russia', 'Left IACS in 2022.'],
  ['Vietnam Register', 'VR', 'Vietnam', ''],
  ['Biro Klasifikasi Indonesia', 'BKI', 'Indonesia', ''],
  ['Emirates Classification Society (Tasneef)', 'TASNEEF', 'United Arab Emirates', ''],
  ['Hellenic Register of Shipping', 'HRS', 'Greece', ''],
  ['Phoenix Register of Shipping', 'PHRS', 'Greece', ''],
  ['Isthmus Bureau of Shipping', 'IBS', 'Panama', ''],
  ['Overseas Marine Certification Services', 'OMCS', 'Panama', ''],
  ['Bulgarian Register of Shipping', 'BRS', 'Bulgaria', ''],
];
export const SURVEYS = [
  ['Annual survey', 'Every year, within 3 months either side of the anniversary date of the class certificate.', 'A general look at hull, machinery, equipment and fittings to confirm the ship is kept in class condition.'],
  ['Intermediate survey', 'In place of the 2nd or 3rd annual survey.', 'More than an annual: extra checks, for example of ballast tanks and, on older ships, cargo spaces; thickness measurements where needed.'],
  ['Special survey (class renewal)', 'Every 5 years; may start from the 4th annual and be done in parts.', 'The full survey: hull structure, tanks, machinery and systems in depth, with thickness measurements; renews the class certificate for 5 years.'],
  ['Docking (bottom) survey', 'Twice in each 5-year period, not more than 36 months apart; one with the special survey.', 'The underwater hull, rudder, propeller, sea chests and valves, in dry dock. An in-water survey (IWS) by approved divers may take the place of the intermediate one if the ship qualifies.'],
  ['Tailshaft (propeller shaft) survey', 'Usually every 5 years; longer or partial with an approved monitoring scheme, shorter for some designs.', 'Shaft drawn or examined in place, with the bearings, seals and propeller fitting.'],
  ['Boiler survey', 'Twice in each 5-year period, not more than 36 months apart (main and auxiliary steam boilers).', 'Internal and external examination, safety valves set and tested.'],
  ['Continuous survey (hull and machinery)', 'Every item at least once in the 5-year cycle.', 'Instead of everything at the special survey, items are surveyed in turn; Chief Engineers may be approved to examine some machinery, confirmed by the surveyor.'],
  ['Planned maintenance scheme (PMS)', 'Audited yearly at the annual survey.', 'A class-approved PMS lets machinery be credited on the ship’s own maintenance records and condition monitoring.'],
  ['Enhanced Survey Programme (ESP)', 'With the annual, intermediate and special surveys.', 'For bulk carriers, oil tankers and chemical tankers: closer survey of structure, thickness measurement, a survey report file kept on board.'],
  ['Occasional survey', 'When needed.', 'After damage, repairs, conversions, a condition of class, or a port state request.'],
  ['Condition Assessment Programme (CAP)', 'Voluntary.', 'A graded assessment (CAP 1 to 4) asked for by charterers, mostly for older tankers and bulk carriers.'],
];
export const CLASS_NOTES = [
  'Class is the society’s own standard for structure and machinery; statutory certificates are the flag state’s, though the flag often lets the class society survey and issue them as its Recognised Organisation (RO).',
  'Conditions of class (recommendations) must be dealt with by the date set or the class is suspended.',
  'Class is suspended if surveys are overdue (beyond the windows) and may be withdrawn; insurance and charter parties usually need the ship in class.',
  'IACS (International Association of Classification Societies) sets common rules and requirements (URs, UIs, CSR) for its 12 members.',
  'Surveys are harmonised with the statutory surveys (HSSC) so the dates and windows line up.',
];

// ---------------------------------------------------------- certificates
// UK flag (MCA). Each: [name, validity, issued by, notes]. "RO": a
// classification society authorised by the MCA to survey and certify for it.
export const CERT_GROUPS = [
  ['Registry and identity', [
    ['Certificate of British Registry', '5 years (Part I of the UK Ship Register), then renewed.', 'UK Ship Register (part of the MCA).', 'Proof of the ship’s nationality and ownership: entitles her to fly the Red Ensign. Changes of owner, name or particulars must be registered.'],
    ['Continuous Synopsis Record (CSR)', 'Kept for the ship’s life; a new document is issued with each change.', 'Flag state (UK Ship Register).', 'SOLAS XI-1/5: the ship’s history of flag, name, owners, managers, class and security organisation. Old documents stay on board.'],
    ['Minimum Safe Manning Document', 'No set expiry; reissued when the ship, her trade or her equipment change.', 'MCA.', 'SOLAS V/14: the least number and grades of crew to keep the ship safe. The ship must not sail below it.'],
    ['International Tonnage Certificate (1969)', 'No expiry while the ship is unchanged; reissued after changes that affect tonnage.', 'MCA or an RO on its behalf.', 'Gross and net tonnage under the Tonnage Convention 1969: the basis for fees, dues and many rules.'],
    ['Ship Radio Licence', 'Revalidated at least every 10 years (Ofcom).', 'Ofcom (the UK radio regulator), not the MCA.', 'Authorises the ship’s radio equipment and call sign / MMSI.'],
  ]],
  ['SOLAS safety', [
    ['Passenger Ship Safety Certificate', '1 year (renewal survey each year).', 'MCA (passenger ships are surveyed by MCA surveyors).', 'SOLAS for passenger ships on international voyages: construction, machinery, fire, life-saving, radio and navigation. Record of Equipment (Form P) attached.'],
    ['Cargo Ship Safety Construction Certificate', '5 years; annual surveys and an intermediate survey (2nd or 3rd year) endorsed on it.', 'An RO on behalf of the MCA.', 'SOLAS II-1 and II-2: hull, machinery, electrical installations and structural fire protection. Includes bottom inspections twice in five years.'],
    ['Cargo Ship Safety Equipment Certificate', '5 years; annual and periodical surveys endorsed.', 'MCA or an RO on its behalf.', 'Life-saving appliances, fire-fighting, navigation equipment and plans. Record of Equipment (Form E) attached.'],
    ['Cargo Ship Safety Radio Certificate', '5 years; periodical (annual) surveys endorsed.', 'MCA or an RO on its behalf.', 'GMDSS radio installation, sea areas the ship is fitted for, maintenance arrangements. Record of Equipment (Form R) attached. Shore-based maintenance arrangements must be in place.'],
    ['Cargo Ship Safety Certificate', '5 years; annual, intermediate and periodical surveys.', 'An RO on behalf of the MCA.', 'May replace the three cargo ship certificates above as a single certificate (Form C attached).'],
    ['Document of Compliance for Dangerous Goods', 'Up to 5 years, in line with the Safety Construction Certificate.', 'MCA or an RO on its behalf.', 'SOLAS II-2/19: the ship’s spaces fitted for carrying packaged and solid bulk dangerous goods, and which classes.'],
    ['Polar Ship Certificate', '5 years, in line with the safety certificates.', 'An RO on behalf of the MCA.', 'Polar Code: the ship’s category (A, B or C), ice class, operating limits and temperatures. Polar Water Operational Manual on board.'],
    ['Exemption Certificate', 'No longer than the certificate it relates to.', 'MCA.', 'Where the MCA exempts the ship from a requirement, with any conditions. Kept with the certificate concerned.'],
    ['Safety management: Safety Management Certificate (SMC)', '5 years; an intermediate verification between the 2nd and 3rd anniversary.', 'MCA or an RO on its behalf.', 'ISM Code: the ship operates to the company’s approved Safety Management System. Needs the company’s DOC to be valid.'],
    ['Document of Compliance (DOC, the company’s)', '5 years; annual verification of the company.', 'MCA or an RO on its behalf.', 'ISM Code: the company’s SMS meets the Code. A copy is kept on board.'],
    ['International Ship Security Certificate (ISSC)', '5 years; an intermediate verification.', 'MCA or an RO authorised by it.', 'ISPS Code: the ship has an approved Ship Security Plan and Ship Security Officer, and security equipment works.'],
  ]],
  ['Load lines and stability', [
    ['International Load Line Certificate', '5 years; annual surveys endorsed.', 'An RO on behalf of the MCA.', 'Load Line Convention 1966: freeboards and the conditions of assignment (closing appliances, freeing ports, guard rails). The marks on the hull must match.'],
    ['International Load Line Exemption Certificate', 'No longer than 5 years.', 'MCA.', 'For a ship exempted from some load line rules, e.g. a single voyage.'],
    ['Approved stability information (booklet)', 'No expiry; reapproved after changes affecting stability.', 'MCA or an RO on its behalf.', 'Not a certificate but approved: loading conditions, limits, the inclining experiment results.'],
  ]],
  ['MARPOL and the environment', [
    ['IOPP Certificate (oil pollution prevention)', '5 years; annual and intermediate surveys.', 'An RO on behalf of the MCA.', 'MARPOL Annex I: oily water separator, sludge tanks, ODME on tankers. Supplement Form A (non-tankers) or B (oil tankers).'],
    ['International NLS Certificate (noxious liquids)', '5 years; annual and intermediate surveys.', 'An RO on behalf of the MCA.', 'MARPOL Annex II, for ships carrying noxious liquid substances in bulk (chemical tankers hold the Certificate of Fitness instead).'],
    ['ISPP Certificate (sewage)', '5 years; no annual surveys.', 'An RO on behalf of the MCA.', 'MARPOL Annex IV: sewage treatment plant or holding tank, discharge connection.'],
    ['Garbage management plan and record book', 'Kept up to date; no certificate.', 'The ship (no flag certificate).', 'MARPOL Annex V (ships of 100 GT and over, or certified for 15 persons or more).'],
    ['IAPP Certificate (air pollution prevention)', '5 years; annual and intermediate surveys.', 'An RO on behalf of the MCA.', 'MARPOL Annex VI: ozone-depleting substances, NOx (engine certificates), SOx (fuel or scrubber), incinerator, VOC.'],
    ['EIAPP Certificate (engine)', 'For the life of the engine, while it is not altered.', 'An RO on behalf of the MCA (or the engine’s flag of manufacture).', 'NOx Technical Code: each diesel engine over 130 kW meets its NOx Tier; the Technical File stays with the engine.'],
    ['IEE Certificate (energy efficiency)', 'For the life of the ship; reissued after major conversion.', 'An RO on behalf of the MCA.', 'MARPOL Annex VI: EEDI/EEXI and the Ship Energy Efficiency Management Plan (SEEMP).'],
    ['Statement of Compliance: fuel oil consumption (DCS)', 'Each year, for the reporting year (kept on board for 5 years).', 'MCA or an RO on its behalf.', 'MARPOL Annex VI/27: the ship reported her fuel consumption under the IMO Data Collection System. The CII rating goes with it.'],
    ['International Anti-Fouling System Certificate', 'No expiry; endorsed when the hull coating is changed.', 'An RO on behalf of the MCA.', 'AFS Convention: no harmful anti-fouling paint (TBT, cybutryne). Ships under 400 GT carry a Declaration instead.'],
    ['International Ballast Water Management Certificate', '5 years; annual and intermediate surveys.', 'An RO on behalf of the MCA.', 'BWM Convention: approved Ballast Water Management Plan and the treatment system (D-2 standard). Ballast Water Record Book kept.'],
    ['Inventory of Hazardous Materials (Statement of Compliance)', 'Kept up to date; renewed with the surveys.', 'An RO.', 'Hong Kong Convention and the UK Ship Recycling Regulations: hazardous materials in the structure and equipment.'],
  ]],
  ['Cargo carrying', [
    ['International Certificate of Fitness for the Carriage of Liquefied Gases in Bulk', '5 years; annual and intermediate surveys.', 'An RO on behalf of the MCA.', 'IGC Code: gas carriers; the gases she may carry and the conditions.'],
    ['International Certificate of Fitness for the Carriage of Dangerous Chemicals in Bulk', '5 years; annual and intermediate surveys.', 'An RO on behalf of the MCA.', 'IBC Code: chemical tankers; the products and tanks listed.'],
    ['Document of Authorisation for the carriage of grain', 'No expiry while the ship is unchanged.', 'MCA or an RO on its behalf.', 'International Grain Code: the approved grain loading manual for loading grain in bulk.'],
    ['Cargo Securing Manual (approved)', 'No expiry; reapproved after changes.', 'MCA or an RO on its behalf.', 'SOLAS VI and VII: how cargo is stowed and secured on this ship.'],
    ['Register of lifting appliances and cargo handling gear', 'Thorough examination every 12 months; load test at least every 5 years and after repairs.', 'Competent persons; the ship keeps the register.', 'UK Lifting Operations and Lifting Equipment Regulations (merchant shipping) and ILO 152: cranes, derricks, wires, loose gear.'],
  ]],
  ['Crew and living conditions', [
    ['Maritime Labour Certificate', '5 years; an intermediate inspection between the 2nd and 3rd anniversary.', 'MCA or an RO on its behalf.', 'MLC 2006: seafarers’ conditions (agreements, hours of rest, accommodation, food, medical care, complaints) meet the Convention.'],
    ['Declaration of Maritime Labour Compliance (DMLC)', 'With the Maritime Labour Certificate.', 'Part I: MCA. Part II: the shipowner, endorsed by the MCA or RO.', 'Part I sets out the UK’s requirements; Part II how the shipowner meets them on this ship.'],
    ['MLC financial security certificates', 'For the period of the insurance cover.', 'The insurer (P&I club), not the flag.', 'MLC 2006 Regulations 2.5 and 4.2: cover for repatriation if abandoned, and for death or long-term disability claims.'],
    ['Ship Sanitation Control (Exemption) Certificate', '6 months (may be extended 1 month).', 'A port health authority (IHR 2005), not the flag.', 'Shows the ship was inspected for public health risks (rats, insects, water, food) and any control measures.'],
    ['Medical stores (medicine chest) certificate', 'Usually each year.', 'A pharmacist or supplier, to the MCA’s Merchant Shipping (Medical Stores) rules.', 'The medicines and equipment carried match the category the ship needs.'],
  ]],
  ['Liability and insurance (issued by the flag)', [
    ['Bunker Convention Certificate', 'Up to the end of the insurance, at most a year at a time.', 'MCA, on the insurer’s “blue card”.', 'Bunkers Convention 2001: ships over 1,000 GT insured against bunker oil pollution damage.'],
    ['CLC Certificate (oil tankers)', 'Up to the end of the insurance, at most a year at a time.', 'MCA, on the insurer’s blue card.', 'Civil Liability Convention 1992: tankers carrying over 2,000 tonnes of persistent oil as cargo.'],
    ['Wreck Removal Convention Certificate', 'Up to the end of the insurance, at most a year at a time.', 'MCA, on the insurer’s blue card.', 'Nairobi Convention 2007: ships of 300 GT and over insured for locating, marking and removing a wreck.'],
    ['Athens Convention Certificate (passenger ships)', 'Up to the end of the insurance, at most a year at a time.', 'MCA, on the insurer’s blue card.', 'Athens Convention 2002: insurance for passengers’ death, injury and luggage claims.'],
  ]],
  ['Class (not the flag, but always asked for)', [
    ['Certificate of Class (hull and machinery)', '5 years; annual and intermediate surveys, docking twice in 5 years.', 'The classification society.', 'The ship meets the society’s rules. Needed for insurance and most charters; see the Class tab for the surveys.'],
  ]],
];
export const CERT_NOTES = [
  'Five-year statutory certificates follow the harmonised system (HSSC): annual surveys within 3 months either side of each anniversary, an intermediate survey between the 2nd and 3rd anniversaries, renewal within the last 3 months keeps the old expiry date.',
  'A certificate may be extended up to 3 months to let the ship reach her port of survey, or 1 month for a short voyage; the MCA must agree.',
  'The MCA delegates most cargo-ship surveys and certificates to its Recognised Organisations (ROs): ABS, BV, ClassNK, DNV, KR, LR and RINA. Passenger ships are surveyed by the MCA itself.',
  'Originals are kept on board and shown to port state control; certificates lapse if surveys are missed, the ship changes flag, or she is not kept to the standard.',
  'The MCA’s Merchant Shipping Notices (MSNs) and Marine Guidance Notes (MGNs), and the certificates’ own wording, give the UK detail.',
];
