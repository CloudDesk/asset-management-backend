// Geo to Timezone mapping utility
export const geoToTimezoneMap: Record<string, string> = {
  'IN': 'Asia/Kolkata',
  'US': 'America/New_York',
  'UK': 'Europe/London',
  'CA': 'America/Toronto',
  'AU': 'Australia/Sydney',
  'DE': 'Europe/Berlin',
  'FR': 'Europe/Paris',
  'JP': 'Asia/Tokyo',
  'CN': 'Asia/Shanghai',
  'SG': 'Asia/Singapore',
  'AE': 'Asia/Dubai',
  'SA': 'Asia/Riyadh',
  'BR': 'America/Sao_Paulo',
  'MX': 'America/Mexico_City',
  'RU': 'Europe/Moscow',
  'IT': 'Europe/Rome',
  'ES': 'Europe/Madrid',
  'NL': 'Europe/Amsterdam',
  'SE': 'Europe/Stockholm',
  'NO': 'Europe/Oslo',
  'DK': 'Europe/Copenhagen',
  'FI': 'Europe/Helsinki',
  'PL': 'Europe/Warsaw',
  'CZ': 'Europe/Prague',
  'HU': 'Europe/Budapest',
  'AT': 'Europe/Vienna',
  'CH': 'Europe/Zurich',
  'BE': 'Europe/Brussels',
  'PT': 'Europe/Lisbon',
  'IE': 'Europe/Dublin',
  'GR': 'Europe/Athens',
  'TR': 'Europe/Istanbul',
  'ZA': 'Africa/Johannesburg',
  'EG': 'Africa/Cairo',
  'NG': 'Africa/Lagos',
  'KE': 'Africa/Nairobi',
  'MA': 'Africa/Casablanca',
  'TN': 'Africa/Tunis',
  'DZ': 'Africa/Algiers',
  'LY': 'Africa/Tripoli',
  'SD': 'Africa/Khartoum',
  'ET': 'Africa/Addis_Ababa',
  'GH': 'Africa/Accra',
  'UG': 'Africa/Kampala',
  'TZ': 'Africa/Dar_es_Salaam',
  'ZM': 'Africa/Lusaka',
  'ZW': 'Africa/Harare',
  'BW': 'Africa/Gaborone',
  'NA': 'Africa/Windhoek',
  'SZ': 'Africa/Mbabane',
  'LS': 'Africa/Maseru',
  'MW': 'Africa/Blantyre',
  'MZ': 'Africa/Maputo',
  'MG': 'Indian/Antananarivo',
  'MU': 'Indian/Mauritius',
  'SC': 'Indian/Mahe',
  'KM': 'Indian/Comoro',
  'DJ': 'Africa/Djibouti',
  'SO': 'Africa/Mogadishu',
  'ER': 'Africa/Asmara',
  'SS': 'Africa/Juba',
  'CF': 'Africa/Bangui',
  'TD': 'Africa/Ndjamena',
  'NE': 'Africa/Niamey',
  'ML': 'Africa/Bamako',
  'BF': 'Africa/Ouagadougou',
  'CI': 'Africa/Abidjan',
  'LR': 'Africa/Monrovia',
  'SL': 'Africa/Freetown',
  'GN': 'Africa/Conakry',
  'GW': 'Africa/Bissau',
  'GM': 'Africa/Banjul',
  'SN': 'Africa/Dakar',
  'MR': 'Africa/Nouakchott',
  'CV': 'Atlantic/Cape_Verde',
  'ST': 'Africa/Sao_Tome',
  'GQ': 'Africa/Malabo',
  'GA': 'Africa/Libreville',
  'CG': 'Africa/Brazzaville',
  'CD': 'Africa/Kinshasa',
  'AO': 'Africa/Luanda',
  'CM': 'Africa/Douala',
  'TD': 'Africa/Ndjamena',
  'NE': 'Africa/Niamey',
  'ML': 'Africa/Bamako',
  'BF': 'Africa/Ouagadougou',
  'CI': 'Africa/Abidjan',
  'LR': 'Africa/Monrovia',
  'SL': 'Africa/Freetown',
  'GN': 'Africa/Conakry',
  'GW': 'Africa/Bissau',
  'GM': 'Africa/Banjul',
  'SN': 'Africa/Dakar',
  'MR': 'Africa/Nouakchott',
  'CV': 'Atlantic/Cape_Verde',
  'ST': 'Africa/Sao_Tome',
  'GQ': 'Africa/Malabo',
  'GA': 'Africa/Libreville',
  'CG': 'Africa/Brazzaville',
  'CD': 'Africa/Kinshasa',
  'AO': 'Africa/Luanda',
  'CM': 'Africa/Douala'
};

// Get timezone from geo code
export const getTimezoneFromGeo = (geo: string): string => {
  return geoToTimezoneMap[geo.toUpperCase()] || 'UTC';
};

// Get geo code from timezone
export const getGeoFromTimezone = (timezone: string): string => {
  const entry = Object.entries(geoToTimezoneMap).find(([_, tz]) => tz === timezone);
  return entry ? entry[0] : 'US'; // Default to US if not found
};

// Validate geo code
export const isValidGeoCode = (geo: string): boolean => {
  return geo.toUpperCase() in geoToTimezoneMap;
};

// Get all supported geo codes
export const getSupportedGeoCodes = (): string[] => {
  return Object.keys(geoToTimezoneMap);
};

// Get all supported timezones
export const getSupportedTimezones = (): string[] => {
  return Object.values(geoToTimezoneMap);
};
