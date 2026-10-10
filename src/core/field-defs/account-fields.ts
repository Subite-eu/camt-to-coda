import type { FieldDef } from './types.js';
/** CODA 2.6 §7.5: Belgian BBAN packs currency inside the 37-position zone. */
export function accountFields(defs: FieldDef[], structure: string): FieldDef[] {
    if (structure !== '0')
        return defs;
    const start = defs.find(f => f.name === 'accountNumber')!.start;
    return defs.flatMap(def => def.name === 'accountNumber' ? [
        { ...def, length: 12 },
        { name: 'accountBlank', start: start + 12, length: 1, description: 'Blank after Belgian BBAN' },
        { name: 'currency', start: start + 13, length: 3, description: 'Currency (Belgian BBAN layout)', sourceXPath: 'Acct/Ccy' },
        { name: 'qualification', start: start + 16, length: 1, description: 'Qualification code' },
        { name: 'countryCode', start: start + 17, length: 2, description: 'ISO country code' },
        { name: 'accountBlanks', start: start + 19, length: 3, description: 'Blanks' },
        { name: 'accountExtension', start: start + 22, length: 15, description: 'Account extension' },
    ] : def.name === 'currency' ? [] : [def]);
}
