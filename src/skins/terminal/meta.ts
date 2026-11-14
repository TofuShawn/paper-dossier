import type { SkinMeta } from '../contract';

/**
 * Terminal — acid layout, Endfield ink. A line printer's page.
 *
 * Not a colourway of the archive fiction, and no longer a dark console. Three
 * design languages are merged here, and the merge is the point: each owns a
 * different layer, and one of them is adopted while its palette is refused.
 *
 *   - INDUSTRIAL owns the typography. Wide stretched capitals (Saira, 125%
 *     width axis), tabular numerals, 10–11px micro-labels with heavy tracking,
 *     cut corners as register marks.
 *   - MINIMAL owns the field. `#FCFBF7` sheet on an `#EFEEE8` desk, 1160px
 *     measure, 56px margins, 1.8 leading, no shadow and no radius. The restraint
 *     is functional: it is what lets the third layer land without becoming noise.
 *   - ACID owns the structure — offset plates, colour bars, a step wedge, marks
 *     deliberately too large for their job — but *not* the colour. Acid's palette
 *     is refused because this skin already has one ink and it is Endfield yellow.
 *
 * The single-ink palette is a measured value ladder, and the ladder is the whole
 * discipline: the purer the yellow, the less it may do.
 *
 *   #FFFA00  1.07:1 on paper  → fill only, never a mark or a word
 *   #989200  3.15:1           → the graphic tier (rules, the ghost numeral)
 *   #6B6400  5.88:1           → heavy marks
 *   #4A4600  9.36:1           → anything read as text
 *
 * `marquee` is now false: a scrolling telemetry strip was the one piece of the
 * console that measured nothing. The ceremony and the figures say "machine"
 * already, and they have to justify themselves with real numbers.
 */
const terminal: SkinMeta = {
  id: 'terminal',
  name: 'Terminal',
  tagline: 'Acid layout, one ink',
  scheme: 'light',
  themeColor: '#fcfbf7',
  swatch: '#fffa00',
  features: {
    unseal: true,
    halftone: true,
    scanline: false,
    hud: false,
    printArtifacts: false,
    barcode: true,
    columnRules: true,
    crt: false,
    marquee: false,
    destijl: false,
    punchcard: false,
    morse: false,
  },
};

export default terminal;
