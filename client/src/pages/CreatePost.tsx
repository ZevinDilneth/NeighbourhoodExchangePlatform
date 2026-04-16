import React, { useState, useEffect, useRef } from 'react';
import RichTextEditor from '../components/RichTextEditor';
import PublicPlacePicker from '../components/PublicPlacePicker';
import { Box, Alert, Typography, Dialog, DialogContent, IconButton } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/layout/Layout';
import VideoVerificationGate from '../components/VideoVerificationGate';
import PhoneVerificationGate from '../components/PhoneVerificationGate';
import EmailVerificationGate from '../components/EmailVerificationGate';
import { useAuth } from '../context/AuthContext';
import { containsProfanity, PROFANITY_ERROR } from '../utils/contentFilter';
import api from '../services/api';
import { scanMedia } from '../utils/scanMedia';

// ─── Constants ────────────────────────────────────────────────────────────────
const GRAD = 'linear-gradient(135deg, #4F46E5, #10B981)';

const FALLBACK_TAGS = [
  'photography', 'cooking', 'gardening', 'coding', 'music', 'yoga',
  'carpentry', 'design', 'writing', 'tutoring', 'languages', 'fitness',
  'cycling', 'sewing', 'drawing', 'baking', 'painting', 'woodworking',
  'repairs', 'tech support', 'pet care', 'childcare', 'eldercare',
  'diy', 'sustainability', 'hiking', 'board games', 'pottery', 'film',
];

const POST_TYPES = [
  { value: 'skill',    icon: 'fa-chalkboard-teacher', label: 'Skill',    desc: 'Share a skill you can teach or offer' },
  { value: 'tool',     icon: 'fa-tools',              label: 'Tool',     desc: 'Lend or borrow a tool or equipment' },
  { value: 'event',    icon: 'fa-calendar-alt',       label: 'Event',    desc: 'Organise a community meetup or workshop' },
  { value: 'question', icon: 'fa-question-circle',    label: 'Question', desc: 'Ask the neighbourhood community' },
];

const PROFICIENCY_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
const TOOL_CONDITIONS    = ['New', 'Excellent', 'Good', 'Fair'];
const TOOL_CONDITION_RF: Record<string, number> = { New: 12, Excellent: 6, Good: 3, Fair: 0 };
// Deposit = market value × this rate (covers risk of damage/loss based on condition)
const DEPOSIT_RATES: Record<string, number> = { New: 0.30, Excellent: 0.25, Good: 0.20, Fair: 0.15 };
// Preset resource category names for events
const EVENT_RESOURCE_PRESETS = [
  'What to Bring', 'Schedule / Agenda', 'Parking & Transit', 'Accessibility',
  'Food & Drinks', 'Prerequisites', 'Dress Code', 'Contact Info',
  'Rules & Guidelines', 'Emergency Procedures',
];

// Preset specification category names for tools
const SPEC_PRESETS = [
  'Fuel Type', 'Power Source', 'Maintenance', 'Weight', 'Dimensions',
  'Brand / Model', 'Age', 'Included Accessories', 'Safety Notes',
  'Operating Instructions', 'Storage Requirements', 'Noise Level',
  'Required PPE', 'Compatibility', 'Warranty',
];

// ── Comprehensive currency list ───────────────────────────────────────────────
interface CurrencyEntry { code: string; name: string; sym: string; }
const ALL_CURRENCIES: CurrencyEntry[] = [
  // Common first
  { code:'USD', name:'US Dollar',            sym:'$'    },
  { code:'EUR', name:'Euro',                 sym:'€'    },
  { code:'GBP', name:'British Pound',        sym:'£'    },
  { code:'CAD', name:'Canadian Dollar',      sym:'CA$'  },
  { code:'AUD', name:'Australian Dollar',    sym:'A$'   },
  { code:'JPY', name:'Japanese Yen',         sym:'¥'    },
  { code:'CHF', name:'Swiss Franc',          sym:'CHF'  },
  { code:'CNY', name:'Chinese Yuan',         sym:'¥'    },
  { code:'INR', name:'Indian Rupee',         sym:'₹'    },
  { code:'MXN', name:'Mexican Peso',         sym:'MX$'  },
  { code:'BRL', name:'Brazilian Real',       sym:'R$'   },
  { code:'SGD', name:'Singapore Dollar',     sym:'S$'   },
  { code:'HKD', name:'Hong Kong Dollar',     sym:'HK$'  },
  { code:'KRW', name:'South Korean Won',     sym:'₩'    },
  { code:'NOK', name:'Norwegian Krone',      sym:'kr'   },
  { code:'SEK', name:'Swedish Krona',        sym:'kr'   },
  { code:'DKK', name:'Danish Krone',         sym:'kr'   },
  { code:'NZD', name:'New Zealand Dollar',   sym:'NZ$'  },
  { code:'ZAR', name:'South African Rand',   sym:'R'    },
  { code:'AED', name:'UAE Dirham',           sym:'AED'  },
  // Extended list
  { code:'AFN', name:'Afghan Afghani',       sym:'؋'    },
  { code:'ALL', name:'Albanian Lek',         sym:'L'    },
  { code:'AMD', name:'Armenian Dram',        sym:'֏'    },
  { code:'ANG', name:'Netherlands Antillean Guilder', sym:'ƒ' },
  { code:'AOA', name:'Angolan Kwanza',       sym:'Kz'   },
  { code:'ARS', name:'Argentine Peso',       sym:'$'    },
  { code:'AWG', name:'Aruban Florin',        sym:'ƒ'    },
  { code:'AZN', name:'Azerbaijani Manat',    sym:'₼'    },
  { code:'BAM', name:'Bosnia-Herzegovina Convertible Mark', sym:'KM' },
  { code:'BBD', name:'Barbadian Dollar',     sym:'$'    },
  { code:'BDT', name:'Bangladeshi Taka',     sym:'৳'    },
  { code:'BGN', name:'Bulgarian Lev',        sym:'лв'   },
  { code:'BHD', name:'Bahraini Dinar',       sym:'BD'   },
  { code:'BMD', name:'Bermudian Dollar',     sym:'$'    },
  { code:'BND', name:'Brunei Dollar',        sym:'$'    },
  { code:'BOB', name:'Bolivian Boliviano',   sym:'Bs'   },
  { code:'BSD', name:'Bahamian Dollar',      sym:'$'    },
  { code:'BTN', name:'Bhutanese Ngultrum',   sym:'Nu'   },
  { code:'BWP', name:'Botswana Pula',        sym:'P'    },
  { code:'BYN', name:'Belarusian Ruble',     sym:'Br'   },
  { code:'BZD', name:'Belize Dollar',        sym:'$'    },
  { code:'CDF', name:'Congolese Franc',      sym:'FC'   },
  { code:'CLP', name:'Chilean Peso',         sym:'$'    },
  { code:'COP', name:'Colombian Peso',       sym:'$'    },
  { code:'CRC', name:'Costa Rican Colón',    sym:'₡'    },
  { code:'CUP', name:'Cuban Peso',           sym:'$'    },
  { code:'CVE', name:'Cape Verdean Escudo',  sym:'$'    },
  { code:'CZK', name:'Czech Koruna',         sym:'Kč'   },
  { code:'DJF', name:'Djiboutian Franc',     sym:'Fr'   },
  { code:'DOP', name:'Dominican Peso',       sym:'$'    },
  { code:'DZD', name:'Algerian Dinar',       sym:'دج'   },
  { code:'EGP', name:'Egyptian Pound',       sym:'£'    },
  { code:'ERN', name:'Eritrean Nakfa',       sym:'Nfk'  },
  { code:'ETB', name:'Ethiopian Birr',       sym:'Br'   },
  { code:'FJD', name:'Fijian Dollar',        sym:'$'    },
  { code:'GEL', name:'Georgian Lari',        sym:'₾'    },
  { code:'GHS', name:'Ghanaian Cedi',        sym:'₵'    },
  { code:'GMD', name:'Gambian Dalasi',       sym:'D'    },
  { code:'GTQ', name:'Guatemalan Quetzal',   sym:'Q'    },
  { code:'GYD', name:'Guyanese Dollar',      sym:'$'    },
  { code:'HNL', name:'Honduran Lempira',     sym:'L'    },
  { code:'HRK', name:'Croatian Kuna',        sym:'kn'   },
  { code:'HTG', name:'Haitian Gourde',       sym:'G'    },
  { code:'HUF', name:'Hungarian Forint',     sym:'Ft'   },
  { code:'IDR', name:'Indonesian Rupiah',    sym:'Rp'   },
  { code:'ILS', name:'Israeli New Shekel',   sym:'₪'    },
  { code:'IQD', name:'Iraqi Dinar',          sym:'ع.د'  },
  { code:'IRR', name:'Iranian Rial',         sym:'﷼'    },
  { code:'ISK', name:'Icelandic Króna',      sym:'kr'   },
  { code:'JMD', name:'Jamaican Dollar',      sym:'$'    },
  { code:'JOD', name:'Jordanian Dinar',      sym:'JD'   },
  { code:'KES', name:'Kenyan Shilling',      sym:'KSh'  },
  { code:'KGS', name:'Kyrgyzstani Som',      sym:'с'    },
  { code:'KHR', name:'Cambodian Riel',       sym:'៛'    },
  { code:'KWD', name:'Kuwaiti Dinar',        sym:'KD'   },
  { code:'KYD', name:'Cayman Islands Dollar',sym:'$'    },
  { code:'KZT', name:'Kazakhstani Tenge',    sym:'₸'    },
  { code:'LAK', name:'Laotian Kip',          sym:'₭'    },
  { code:'LBP', name:'Lebanese Pound',       sym:'£'    },
  { code:'LKR', name:'Sri Lankan Rupee',     sym:'₨'    },
  { code:'LRD', name:'Liberian Dollar',      sym:'$'    },
  { code:'LSL', name:'Lesotho Loti',         sym:'L'    },
  { code:'LYD', name:'Libyan Dinar',         sym:'LD'   },
  { code:'MAD', name:'Moroccan Dirham',      sym:'MAD'  },
  { code:'MDL', name:'Moldovan Leu',         sym:'L'    },
  { code:'MKD', name:'Macedonian Denar',     sym:'ден'  },
  { code:'MMK', name:'Myanmar Kyat',         sym:'K'    },
  { code:'MNT', name:'Mongolian Tögrög',     sym:'₮'    },
  { code:'MOP', name:'Macanese Pataca',      sym:'P'    },
  { code:'MUR', name:'Mauritian Rupee',      sym:'₨'    },
  { code:'MVR', name:'Maldivian Rufiyaa',    sym:'Rf'   },
  { code:'MWK', name:'Malawian Kwacha',      sym:'MK'   },
  { code:'MYR', name:'Malaysian Ringgit',    sym:'RM'   },
  { code:'MZN', name:'Mozambican Metical',   sym:'MT'   },
  { code:'NAD', name:'Namibian Dollar',      sym:'$'    },
  { code:'NGN', name:'Nigerian Naira',       sym:'₦'    },
  { code:'NIO', name:'Nicaraguan Córdoba',   sym:'C$'   },
  { code:'NPR', name:'Nepalese Rupee',       sym:'₨'    },
  { code:'OMR', name:'Omani Rial',           sym:'﷼'    },
  { code:'PAB', name:'Panamanian Balboa',    sym:'B/.'  },
  { code:'PEN', name:'Peruvian Sol',         sym:'S/.'  },
  { code:'PGK', name:'Papua New Guinean Kina',sym:'K'   },
  { code:'PHP', name:'Philippine Peso',      sym:'₱'    },
  { code:'PKR', name:'Pakistani Rupee',      sym:'₨'    },
  { code:'PLN', name:'Polish Złoty',         sym:'zł'   },
  { code:'PYG', name:'Paraguayan Guaraní',   sym:'₲'    },
  { code:'QAR', name:'Qatari Riyal',         sym:'﷼'    },
  { code:'RON', name:'Romanian Leu',         sym:'lei'  },
  { code:'RSD', name:'Serbian Dinar',        sym:'din'  },
  { code:'RUB', name:'Russian Ruble',        sym:'₽'    },
  { code:'SAR', name:'Saudi Riyal',          sym:'﷼'    },
  { code:'SBD', name:'Solomon Islands Dollar',sym:'$'   },
  { code:'SCR', name:'Seychellois Rupee',    sym:'₨'    },
  { code:'SDG', name:'Sudanese Pound',       sym:'£'    },
  { code:'SLL', name:'Sierra Leonean Leone', sym:'Le'   },
  { code:'SOS', name:'Somali Shilling',      sym:'Sh'   },
  { code:'SRD', name:'Surinamese Dollar',    sym:'$'    },
  { code:'STD', name:'São Tomé Dobra',       sym:'Db'   },
  { code:'SVC', name:'Salvadoran Colón',     sym:'₡'    },
  { code:'SYP', name:'Syrian Pound',         sym:'£'    },
  { code:'SZL', name:'Swazi Lilangeni',      sym:'L'    },
  { code:'THB', name:'Thai Baht',            sym:'฿'    },
  { code:'TJS', name:'Tajikistani Somoni',   sym:'SM'   },
  { code:'TMT', name:'Turkmenistani Manat',  sym:'T'    },
  { code:'TND', name:'Tunisian Dinar',       sym:'DT'   },
  { code:'TOP', name:'Tongan Paʻanga',       sym:'T$'   },
  { code:'TRY', name:'Turkish Lira',         sym:'₺'    },
  { code:'TTD', name:'Trinidad & Tobago Dollar', sym:'$' },
  { code:'TWD', name:'New Taiwan Dollar',    sym:'NT$'  },
  { code:'TZS', name:'Tanzanian Shilling',   sym:'Sh'   },
  { code:'UAH', name:'Ukrainian Hryvnia',    sym:'₴'    },
  { code:'UGX', name:'Ugandan Shilling',     sym:'Sh'   },
  { code:'UYU', name:'Uruguayan Peso',       sym:'$'    },
  { code:'UZS', name:'Uzbekistani Som',      sym:'лв'   },
  { code:'VES', name:'Venezuelan Bolívar',   sym:'Bs.F' },
  { code:'VND', name:'Vietnamese Đồng',      sym:'₫'    },
  { code:'VUV', name:'Vanuatu Vatu',         sym:'VT'   },
  { code:'WST', name:'Samoan Tālā',          sym:'T'    },
  { code:'XAF', name:'Central African CFA Franc', sym:'Fr' },
  { code:'XCD', name:'East Caribbean Dollar',sym:'$'    },
  { code:'XOF', name:'West African CFA Franc',sym:'Fr'  },
  { code:'YER', name:'Yemeni Rial',          sym:'﷼'    },
  { code:'ZMW', name:'Zambian Kwacha',       sym:'ZK'   },
  { code:'ZWL', name:'Zimbabwean Dollar',    sym:'$'    },
];
// For backward compat — derive symbol map from the list
const CURRENCY_SYMBOLS: Record<string, string> = Object.fromEntries(ALL_CURRENCIES.map(c => [c.code, c.sym]));
const COMMON_CURRENCIES = ALL_CURRENCIES.slice(0, 20).map(c => c.code);
const EVENT_CATEGORIES   = ['Workshop', 'Meetup', 'Swap', 'Class', 'Social', 'Other'];
const LANGUAGES = [
  'English', 'French', 'Spanish', 'Mandarin', 'Cantonese', 'Arabic', 'Hindi',
  'Portuguese', 'German', 'Italian', 'Japanese', 'Korean', 'Tagalog', 'Vietnamese',
  'Punjabi', 'Tamil', 'Urdu', 'Greek', 'Polish', 'Russian',
];

const STEPS = [
  { num: 1, label: 'Post Type',  icon: 'fa-th-large' },
  { num: 2, label: 'Content',    icon: 'fa-edit' },
  { num: 3, label: 'Details',    icon: 'fa-sliders-h' },
  { num: 4, label: 'Review',     icon: 'fa-clipboard-check' },
];

const COMMON_TOOLS = [
  // Power tools
  'Power Drill', 'Circular Saw', 'Jigsaw', 'Reciprocating Saw', 'Miter Saw',
  'Table Saw', 'Belt Sander', 'Orbital Sander', 'Detail Sander', 'Random Orbit Sander',
  'Angle Grinder', 'Rotary Tool (Dremel)', 'Router', 'Planer', 'Jointer',
  'Air Compressor', 'Nail Gun', 'Staple Gun', 'Heat Gun', 'Hot Glue Gun',
  // Hand tools
  'Hammer', 'Rubber Mallet', 'Screwdriver Set', 'Wrench Set', 'Allen Key Set',
  'Socket Set', 'Torque Wrench', 'Pliers Set', 'Needle-Nose Pliers', 'Wire Cutters',
  'Utility Knife', 'Chisel Set', 'Hand Saw', 'Hacksaw', 'Level',
  'Tape Measure', 'Square', 'Clamps', 'Vise', 'Wire Stripper',
  // Garden & outdoor
  'Lawn Mower', 'Leaf Blower', 'String Trimmer', 'Hedge Trimmer', 'Chainsaw',
  'Pressure Washer', 'Garden Tiller', 'Aerator', 'Wheelbarrow', 'Pruning Shears',
  'Shovel', 'Spade', 'Rake', 'Garden Hoe', 'Post Hole Digger',
  // Measuring & layout
  'Laser Level', 'Stud Finder', 'Digital Multimeter', 'Voltage Tester',
  'Wire Fishing Kit', 'Oscilloscope', 'Soldering Iron',
  // Cleaning
  'Wet/Dry Vacuum', 'Steam Cleaner', 'Carpet Cleaner', 'Pressure Washer',
  // Photography & tech
  'DSLR Camera', 'Mirrorless Camera', 'Tripod', 'Lighting Kit', 'GoPro',
  'Drone', 'Projector', 'PA System', 'Microphone', 'Video Camera',
  // Moving & lifting
  'Dolly / Hand Truck', 'Moving Blankets', 'Furniture Sliders', 'Strap Ratchets',
  'Ladder (Step)', 'Ladder (Extension)', 'Scaffolding',
  // Kitchen & home
  'Stand Mixer', 'Food Processor', 'Bread Maker', 'Ice Cream Maker',
  'Waffle Iron', 'Pressure Cooker', 'Sous Vide', 'Dehydrator',
  // Automotive
  'Car Jack', 'Jack Stands', 'OBD Scanner', 'Jumper Cables', 'Tire Inflator',
  'Battery Charger', 'Impact Wrench', 'Oil Drain Pan',
  // Sewing & crafts
  'Sewing Machine', 'Serger', 'Embroidery Machine', 'Cutting Plotter', 'Loom',
  'Knitting Machine', '3D Printer', 'Laser Cutter', 'CNC Router',
];

// ─── CEU / Schedule helpers (mirrors CreateExchange) ─────────────────────────
const PROF_MULTS: Record<string, number> = {
  Beginner: 0.8, Intermediate: 1.0, Advanced: 1.2, Expert: 1.5,
};
interface CustomSession { id: string; date: string; timeStart: string; timeEnd: string; }

const parseHours = (start: string, end: string): number => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(0.5, diff > 0 ? diff / 60 : 1);
};
const fmt12 = (t: string): string => {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};
const calcSkillCEU = (hours: number, sess: number, profKey: string): number =>
  Math.max(1, Math.round(hours * (PROF_MULTS[profKey] ?? 1.0))) * Math.max(1, sess);
const calcToolBorrowCEU = (mv: number, days: number, rf = 0): number =>
  Math.max(1, Math.round(mv * 0.001 * days + rf));


// ─── Small reusables ──────────────────────────────────────────────────────────
const SectionTitle: React.FC<{ icon: string; children: React.ReactNode }> = ({ icon, children }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', mb: '1.5rem' }}>
    <i className={`fas ${icon}`} style={{ color: '#4F46E5', fontSize: '1.125rem' }} />
    <Box sx={{ fontWeight: 600, fontSize: '1.25rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif' }}>
      {children}
    </Box>
  </Box>
);

const FormLabel: React.FC<{ required?: boolean; children: React.ReactNode }> = ({ required, children }) => (
  <Box component="label" sx={{
    display: 'block', fontSize: '0.875rem', fontWeight: 500,
    color: '#1F2937', mb: '0.5rem', fontFamily: 'Inter,sans-serif',
  }}>
    {children}{required && <Box component="span" sx={{ color: '#EF4444' }}> *</Box>}
  </Box>
);

const FormHint: React.FC<{ icon: string; children: React.ReactNode }> = ({ icon, children }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem',
    fontSize: '0.75rem', color: '#6B7280', mt: '0.375rem', fontFamily: 'Inter,sans-serif' }}>
    <i className={`fas ${icon}`} style={{ fontSize: '0.65rem' }} />
    {children}
  </Box>
);

const InputBox: React.FC<{
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; readOnly?: boolean; min?: string;
}> = ({ value, onChange, placeholder, type = 'text', readOnly, min }) => (
  <Box component="input" type={type} value={value} readOnly={readOnly} min={min}
    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
    placeholder={placeholder}
    sx={{
      width: '100%', padding: '0.875rem 1rem',
      border: '1px solid #E5E7EB', borderRadius: '0.5rem',
      fontSize: '0.875rem', color: '#1F2937',
      background: readOnly ? '#F9FAFB' : '#FFF',
      outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter,sans-serif',
      transition: 'border-color 0.2s',
      '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' },
      '&::placeholder': { color: '#9CA3AF' },
    }}
  />
);

const SelectBox: React.FC<{
  value: string; onChange: (v: string) => void; children: React.ReactNode; fullWidth?: boolean;
}> = ({ value, onChange, children, fullWidth }) => (
  <Box component="select" value={value}
    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
    sx={{
      width: fullWidth ? '100%' : 'auto',
      padding: '0.875rem 2.5rem 0.875rem 1rem',
      border: '1px solid #E5E7EB', borderRadius: '0.5rem',
      fontSize: '0.875rem', color: '#1F2937',
      background: '#FFF url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236B7280\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E") no-repeat right 0.75rem center / 1.25rem',
      appearance: 'none', outline: 'none', fontFamily: 'Inter,sans-serif', cursor: 'pointer',
      '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' },
    }}
  >
    {children}
  </Box>
);

const SkillContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ background: '#F9FAFB', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #E5E7EB', mb: '1.5rem' }}>
    {children}
  </Box>
);

const CollapsibleSection: React.FC<{
  icon: string; title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}> = ({ icon, title, open, onToggle, children }) => (
  <Box sx={{ mb: '1.5rem' }}>
    <Box onClick={onToggle} sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.875rem 1.25rem', borderRadius: '0.75rem',
      background: '#F9FAFB', border: '1px solid #E5E7EB',
      cursor: 'pointer', userSelect: 'none', transition: 'background 0.2s',
      mb: open ? '1rem' : 0,
      '&:hover': { background: '#F3F4F6' },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <i className={`fas ${icon}`} style={{ color: open ? '#4F46E5' : '#9CA3AF', fontSize: '1rem', transition: 'color 0.2s' }} />
        <Box sx={{ fontWeight: 600, fontSize: '1.05rem', color: open ? '#1F2937' : '#6B7280', fontFamily: 'Poppins,sans-serif', transition: 'color 0.2s' }}>
          {title}
        </Box>
      </Box>
      <Box sx={{
        width: 44, height: 24, borderRadius: 12, flexShrink: 0,
        background: open ? 'linear-gradient(135deg, #4F46E5, #10B981)' : '#D1D5DB',
        position: 'relative', transition: 'background 0.25s',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.12)',
      }}>
        <Box sx={{
          position: 'absolute', top: 3,
          left: open ? 23 : 3,
          width: 18, height: 18, borderRadius: '50%', background: '#FFF',
          boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
          transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </Box>
    </Box>
    {open && <Box>{children}</Box>}
  </Box>
);

// ─── Main Component ───────────────────────────────────────────────────────────
interface CreatePostProps {
  modal?: boolean;
  open?: boolean;
  onClose?: () => void;
  defaultPostType?: string;
  defaultExchangeType?: 'borrow' | 'permanent' | null;
}

const CreatePost: React.FC<CreatePostProps> = ({ modal, open, onClose, defaultPostType, defaultExchangeType }) => {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isPhoneVerified, isEmailVerified } = useAuth();
  const queryClient = useQueryClient();
  const editId      = searchParams.get('edit')       || null;
  const borrowFromId = searchParams.get('borrowFrom') || null;
  const groupId     = searchParams.get('group')      || null;
  const isVideoVerified = Boolean(user?.videoIntro) || Boolean((user as unknown as { isVideoVerified?: boolean })?.isVideoVerified);

  const [step,  setStep]  = useState(0);
  const [error, setError] = useState('');

  // Details step — section visibility toggles
  const [showLocation,         setShowLocation]         = useState(false);
  const [showOnlineOption,     setShowOnlineOption]     = useState(false);
  const [showSchedule,         setShowSchedule]         = useState(false);
  const [showCEU,              setShowCEU]              = useState(false);
  const [showEventDetails,     setShowEventDetails]     = useState(false);
  const [showQuestionDetails,  setShowQuestionDetails]  = useState(false);

  // Step 1
  const defaultType = defaultPostType || searchParams.get('type') || 'skill';
  const [postType, setPostType] = useState(defaultType);

  // Step 2 — Content
  const [title,       setTitle]       = useState('');
  const [toolDropOpen, setToolDropOpen] = useState(false);
  const toolDropRef = useRef<HTMLDivElement>(null);
  const [content,     setContent]     = useState('');
  const [postImages,     setPostImages]     = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]); // saved URLs in edit mode
  const [imageScanning, setImageScanning] = useState(false);
  const [imageScanError, setImageScanError] = useState('');
  const [proficiency,   setProficiency]   = useState('Intermediate');
  const [groupSize,     setGroupSize]     = useState<number | null>(null);
  const [requirements,  setRequirements]  = useState<string[]>([]);
  const [reqInput,      setReqInput]      = useState('');
  const [languages,     setLanguages]     = useState<string[]>([]);

  // Step 3 — Details
  const [bounty,        setBounty]        = useState('0');   // Q&A bounty CEU
  const [toolCondition, setToolCondition] = useState('Good');
  const [eventDate,     setEventDate]     = useState('');
  const [eventEndDate,  setEventEndDate]  = useState('');
  const [eventCapacity, setEventCapacity] = useState('');
  const [eventCategory, setEventCategory] = useState('Workshop');
  const [eventLocation, setEventLocation] = useState('');
  const [questionCategory, setQuestionCategory] = useState('General');
  const [tagInput,         setTagInput]         = useState('');
  const [tags,             setTags]             = useState<string[]>([]);
  const [tagDropdownOpen,  setTagDropdownOpen]  = useState(false);
  const [tagHighlight,     setTagHighlight]     = useState(-1);
  const tagContainerRef = useRef<HTMLDivElement>(null);

  // Live tags from all posts + exchanges, merged with fallback list
  const { data: liveTags } = useQuery<{ label: string; count: number }[]>({
    queryKey: ['all-tags'],
    queryFn: () => api.get('/posts/tags').then(r => r.data),
    staleTime: 60_000,
  });
  const SUGGESTED_TAGS = React.useMemo(() => {
    const apiLabels = (liveTags ?? []).map(t => t.label);
    const merged = [...new Set([...apiLabels, ...FALLBACK_TAGS])];
    return merged;
  }, [liveTags]);
  const [visPublic,     setVisPublic]     = useState(true);
  const [visNotify,     setVisNotify]     = useState(false);
  const [visComments,   setVisComments]   = useState(true);

  // Location (Exchange-style)
  const [locType,         setLocType]         = useState<'public'|'private'>('public');
  const [publicPlace,     setPublicPlace]     = useState('');
  const [privatePlace,    setPrivatePlace]    = useState('');
  const [onlineVideo,     setOnlineVideo]     = useState(false);
  const [onlineOnly,      setOnlineOnly]      = useState(false);
  const [locationLat,     setLocationLat]     = useState<number | null>(null);
  const [locationLng,     setLocationLng]     = useState<number | null>(null);
  const [geoLocating,     setGeoLocating]     = useState(false);
  const [videoLink,       setVideoLink]       = useState('');
  const [videoToken,      setVideoToken]      = useState('');
  const [videoCopied,     setVideoCopied]     = useState(false);
  const [videoGenerating, setVideoGenerating] = useState(false);
  const [videoRoomId,     setVideoRoomId]     = useState('');

  // Value & Schedule (Exchange-style)
  const [extraCeu,        setExtraCeu]        = useState(0);
  const [sessions,        setSessions]        = useState(1);
  const [startDate,       setStartDate]       = useState('');
  const [borrowEndDate,   setBorrowEndDate]   = useState('');
  const [timeStart,       setTimeStart]       = useState('09:00');
  const [timeEnd,         setTimeEnd]         = useState('11:00');
  const [recurring,       setRecurring]       = useState('once');
  const [customSessions,  setCustomSessions]  = useState<CustomSession[]>([
    { id: '1', date: '', timeStart: '09:00', timeEnd: '11:00' },
  ]);
  const [toolExchangeType, setToolExchangeType] = useState<'borrow' | 'permanent' | null>(defaultExchangeType ?? null);
  // Tool Specifications — dynamic categories + detail lines
  interface ToolSpecCategory { id: string; name: string; details: string[]; newDetail: string; }
  const [toolSpecs,      setToolSpecs]      = useState<ToolSpecCategory[]>([]);
  const [specCatInput,   setSpecCatInput]   = useState('');
  const [specCatOpen,    setSpecCatOpen]    = useState(false);
  const [specPresetOpen, setSpecPresetOpen] = useState(false);

  // Event Resources — same pattern as Tool Specifications
  const [eventResources,      setEventResources]      = useState<ToolSpecCategory[]>([]);
  const [resCatInput,         setResCatInput]         = useState('');
  const [resPresetOpen,       setResPresetOpen]       = useState(false);
  const [toolMarketValue,  setToolMarketValue]  = useState('');
  const [userCurrency,     setUserCurrency]     = useState('USD');
  const [currencySearch,   setCurrencySearch]   = useState('');
  const [currencyDropOpen, setCurrencyDropOpen] = useState(false);
  const currencyDropRef = useRef<HTMLDivElement>(null);
  const [exchangeRates,    setExchangeRates]    = useState<Record<string, number>>({});
  const [currencyLoading,  setCurrencyLoading]  = useState(true);

  // Detect user's currency from IP + fetch exchange rates
  useEffect(() => {
    Promise.all([
      fetch('https://ipapi.co/json/').then(r => r.json()).catch(() => ({})),
      fetch('https://open.er-api.com/v6/latest/USD').then(r => r.json()).catch(() => ({ rates: {} })),
    ]).then(([geo, fx]) => {
      if (geo?.currency && COMMON_CURRENCIES.includes(geo.currency)) setUserCurrency(geo.currency);
      if (fx?.rates) setExchangeRates(fx.rates);
    }).finally(() => setCurrencyLoading(false));
  }, []);

  // Sync type from URL param when already mounted
  useEffect(() => {
    const t = searchParams.get('type');
    if (t && POST_TYPES.some(p => p.value === t)) setPostType(t);
  }, [searchParams]);

  // Auto-populate today's date (same as CreateExchange)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setCustomSessions([{ id: '1', date: today, timeStart: '09:00', timeEnd: '11:00' }]);
  }, []);

  useEffect(() => { if (recurring === 'once') setSessions(1); }, [recurring]);

  // Close currency dropdown when clicking outside
  useEffect(() => {
    if (!currencyDropOpen) return;
    const handler = (e: MouseEvent) => {
      if (currencyDropRef.current && !currencyDropRef.current.contains(e.target as Node)) {
        setCurrencyDropOpen(false);
        setCurrencySearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [currencyDropOpen]);

  // Load existing post for edit mode
  const { data: editPost } = useQuery({
    queryKey: ['post-edit', editId],
    queryFn: async () => { const res = await api.get(`/posts/${editId}`); return res.data; },
    enabled: Boolean(editId),
  });

  // Load source tool post when coming from "Request to Borrow"
  const { data: borrowPost } = useQuery({
    queryKey: ['post-borrow', borrowFromId],
    queryFn: async () => { const res = await api.get(`/posts/${borrowFromId}`); return res.data; },
    enabled: Boolean(borrowFromId),
  });
  // Pre-fill form when coming from "Request to Borrow" on a tool detail page
  useEffect(() => {
    if (!borrowPost) return;
    setPostType('tool');
    setTitle(`Borrow Request: ${borrowPost.title || ''}`);
    setContent(borrowPost.content || '');
    // Copy tags (strip type/meta tags)
    const rawTags: string[] = Array.isArray(borrowPost.tags) ? borrowPost.tags : [];
    const normalized = rawTags.length === 1 && rawTags[0].startsWith('[')
      ? (() => { try { return JSON.parse(rawTags[0]); } catch { return rawTags; } })()
      : rawTags;
    setTags(normalized.filter((t: string) =>
      !['skill','tool','event','question','general','beginner','intermediate','advanced','expert'].includes(t.toLowerCase())
    ));
    // Copy tool specifications
    if (Array.isArray(borrowPost.specifications) && borrowPost.specifications.length > 0) {
      setToolSpecs(borrowPost.specifications.map((s: { name: string; details: string[] }, i: number) => ({
        id: String(i + 1),
        name: s.name,
        details: s.details,
        newDetail: '',
      })));
    }
    // Copy schedule details
    if (borrowPost.timeStart) setTimeStart(borrowPost.timeStart);
    if (borrowPost.timeEnd)   setTimeEnd(borrowPost.timeEnd);
    if (borrowPost.recurring) setRecurring(borrowPost.recurring);
    if (borrowPost.sessions)  setSessions(borrowPost.sessions);
    // Set exchange type to borrow and jump to content step
    setToolExchangeType('borrow');
    setStep(1);
  }, [borrowPost]);

  useEffect(() => {
    if (!editPost) return;
    setPostType(editPost.type || 'skill');
    setTitle(editPost.title || '');
    setContent(editPost.content || '');
    // Parse tags — remove type/proficiency tags that are added automatically
    const rawTags: string[] = Array.isArray(editPost.tags) ? editPost.tags : [];
    const normalized = rawTags.length === 1 && rawTags[0].startsWith('[')
      ? (() => { try { return JSON.parse(rawTags[0]); } catch { return rawTags; } })()
      : rawTags;
    const filtered = normalized.filter((t: string) =>
      !['skill','tool','event','question','general','beginner','intermediate','advanced','expert'].includes(t.toLowerCase())
    );
    setTags(filtered);
    // Pre-fill existing media
    if (Array.isArray(editPost.images) && editPost.images.length > 0) {
      setExistingImages(editPost.images as string[]);
    }
    // Pre-fill session details
    if (editPost.groupSize)    setGroupSize(editPost.groupSize);
    if (editPost.requirements) setRequirements(editPost.requirements as string[]);
    if (editPost.languages)    setLanguages(editPost.languages as string[]);
    // Jump straight to step 1 (content) so user doesn't have to re-pick type
    setStep(1);
  }, [editPost]);

  const addCustomSession = () => {
    const today = new Date().toISOString().split('T')[0];
    setCustomSessions(prev => [...prev, { id: String(Date.now()), date: today, timeStart: '09:00', timeEnd: '11:00' }]);
  };
  const removeCustomSession = (id: string) => setCustomSessions(prev => prev.filter(s => s.id !== id));
  const updateCustomSession = (id: string, field: keyof CustomSession, value: string) =>
    setCustomSessions(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));

  // CEU computation
  const sessionHours      = parseHours(timeStart, timeEnd);
  const effectiveSessions = recurring === 'custom' ? customSessions.length : sessions;
  const mvRaw = parseFloat(toolMarketValue) || 0;
  const mvUsd = userCurrency === 'USD' || !exchangeRates[userCurrency]
    ? mvRaw
    : mvRaw / exchangeRates[userCurrency];
  const mv  = mvUsd; // formula always uses USD value
  const sym = CURRENCY_SYMBOLS[userCurrency] ?? userCurrency;
  const mvDisplay = userCurrency !== 'USD' && mvRaw > 0
    ? `${sym}${mvRaw.toFixed(2)} → $${mvUsd.toFixed(2)}`
    : `$${mvUsd.toFixed(2)}`;
  const bd  = (startDate && borrowEndDate)
    ? Math.max(1, Math.round((new Date(borrowEndDate + 'T00:00:00').getTime() - new Date(startDate + 'T00:00:00').getTime()) / 86400000))
    : 1;
  const rf  = TOOL_CONDITION_RF[toolCondition] ?? 0;
  const suggestedCeu =
    postType === 'skill' ? calcSkillCEU(sessionHours, effectiveSessions, proficiency) :
    postType === 'tool'  ? calcToolBorrowCEU(mv, bd, rf) : 0;
  const totalCeu = extraCeu; // user's desired CEU amount

  const selectedType      = POST_TYPES.find(p => p.value === postType) || POST_TYPES[0];
  const needsVerification = ['skill', 'tool'].includes(postType) && !isVideoVerified;

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    setError('');
    if (step === 0 && !postType) { setError('Please select a post type.'); return false; }
    if (step === 1) {
      if (!title.trim())   { setError('Title is required.'); return false; }
      if (!content.trim()) { setError('Content / description is required.'); return false; }
      if (containsProfanity(title, content)) { setError(PROFANITY_ERROR); return false; }
    }
    if (step === 2 && postType === 'event') {
      if (!eventDate) { setError('Start Date & Time is required for events.'); return false; }
      const isOnlineMode = onlineVideo || onlineOnly;
      if (!isOnlineMode && !publicPlace) { setError('Please select a location or enable the online option.'); return false; }
    }
    if (step === 2 && postType === 'question') {
      const bountyNum = Number(bounty) || 0;
      if (bountyNum < 1) { setError('A minimum bounty of 1 CEU is required to post a question.'); return false; }
      if (bountyNum > (user?.ceuBalance ?? 0)) {
        setError(`Not enough CEU for this bounty. You have ${user?.ceuBalance ?? 0} CEU but the bounty is ${bountyNum} CEU.`);
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    if (imageScanning) { setError('Please wait — media scan in progress.'); return; }
    if (step === 0 && !isEmailVerified) return;
    if (step === 0 && !isPhoneVerified) return;
    if (step === 0 && needsVerification) return;
    if (validate()) setStep(s => Math.min(s + 1, 3));
  };
  const goPrev = () => { setError(''); setStep(s => Math.max(s - 1, 0)); };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: () => {
      const allTags = [...tags, postType, ...(proficiency ? [proficiency.toLowerCase()] : [])].filter(Boolean);
      const isOnlineMode = onlineVideo || onlineOnly;
      const locationName = isOnlineMode ? 'Online'
        : locType === 'public' ? publicPlace
        : privatePlace ? '[Private Location — Secure Sharing Enabled]' : undefined;
      const body: Record<string, unknown> = {
        type:      postType,
        title:     title.trim(),
        content:   content.trim(),
        tags:      allTags,
        ceuRate:   (postType === 'skill' || postType === 'tool') ? totalCeu : undefined,
        locationName: locationName || undefined,
        isOnline:  isOnlineMode || undefined,
        onlineLink: isOnlineMode && videoLink ? videoLink : undefined,
        latitude:  (!isOnlineMode && locationLat !== null) ? locationLat : undefined,
        longitude: (!isOnlineMode && locationLng !== null) ? locationLng : undefined,
        startDate: startDate || undefined,
        timeStart: (postType === 'skill' || postType === 'tool') ? timeStart : undefined,
        timeEnd:   (postType === 'skill' || postType === 'tool') ? timeEnd   : undefined,
        recurring: (postType === 'skill' || postType === 'tool') ? recurring : undefined,
        sessions:  (postType === 'skill' || postType === 'tool') ? effectiveSessions : undefined,
        eventDate: eventDate || undefined,
        eventEndDate: eventEndDate || undefined,
        eventCapacity: eventCapacity ? Number(eventCapacity) : undefined,
        eventCategory: eventCategory || undefined,
        eventLocation: eventLocation || undefined,
        questionCategory: questionCategory || undefined,
        bounty: postType === 'question' ? Math.max(0, Number(bounty) || 0) : undefined,
        groupSize:    groupSize ?? undefined,
        requirements: requirements.length ? requirements : undefined,
        languages:    languages.length ? languages : undefined,
        condition: postType === 'tool' ? toolCondition : undefined,
        marketValue: (postType === 'tool' && mvUsd > 0) ? mvUsd : undefined,
        specifications: (postType === 'tool' && toolSpecs.length)
          ? toolSpecs.map(c => ({ name: c.name, details: c.details.filter(Boolean) })).filter(c => c.details.length)
          : (postType === 'event' && eventResources.length)
          ? eventResources.map(c => ({ name: c.name, details: c.details.filter(Boolean) })).filter(c => c.details.length)
          : undefined,
        visibility: { public: visPublic, comments: visComments, notify: visNotify },
        group: groupId || undefined,
      };
      if (postImages.length > 0 || editId) {
        const fd = new FormData();
        // In edit mode always tell the server which existing images to keep
        if (editId) fd.append('existingImages', JSON.stringify(existingImages));
        Object.entries(body).forEach(([k, v]) => {
          if (v !== undefined) fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
        });
        postImages.forEach(img => fd.append('images', img));
        return editId
          ? api.put(`/posts/${editId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
          : api.post('/posts', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      return editId ? api.put(`/posts/${editId}`, body) : api.post('/posts', body);
    },
    onSuccess: (res) => {
      if (editId) {
        // Invalidate cached post so detail page shows fresh data
        queryClient.invalidateQueries({ queryKey: ['post', editId] });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        const updatedPost = res.data as { type?: string; _id?: string };
        const type = updatedPost?.type ?? 'skill';
        const id   = updatedPost?._id ?? editId;
        if (modal) { onClose?.(); } else { navigate(`/${type}/${id}`); }
      } else {
        if (groupId) queryClient.invalidateQueries({ queryKey: ['group-posts', groupId] });
        if (modal) { onClose?.(); } else { navigate(groupId ? `/groups/${groupId}` : '/feed'); }
      }
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Post not saved — check your connection and try again.'
      );
    },
  });

  const handlePost = () => {
    if (!validate()) return;
    mutation.mutate();
  };

  // ── Content placeholder by type ────────────────────────────────────────────
  const contentPlaceholders: Record<string, string> = {
    skill:    'Describe what you can teach or offer...\n• What you\'ll cover\n• Your experience level\n• Duration and format\n• Any prerequisites',
    tool:     'Describe the tool you\'re listing...\n• Make and model\n• Condition and age\n• What it\'s suitable for\n• Any terms for borrowing',
    event:    'Describe your event...\n• What will happen\n• Who should attend\n• What to bring\n• Any costs or requirements',
    question: 'Describe your question in detail...\n• What have you already tried?\n• What outcome are you looking for?\n• Any relevant context',
  };

  // ──────────────────────────────────────────────────────────────────────────
  const formCard = (
    <Box sx={{
      background: '#FFF', border: modal ? 'none' : '1px solid #E5E7EB',
      borderRadius: modal ? 0 : '0.75rem', boxShadow: modal ? 'none' : '0 1px 3px rgba(0,0,0,0.12)',
      overflow: 'hidden',
    }}>

        {/* ── Step Indicator ── */}
        <Box sx={{
          display: 'flex', background: '#F9FAFB',
          borderBottom: '1px solid #E5E7EB', overflowX: 'auto',
          '&::-webkit-scrollbar': { height: 4 },
          '&::-webkit-scrollbar-thumb': { background: '#D1D5DB', borderRadius: 2 },
        }}>
          {STEPS.map((s, idx) => {
            const isActive    = idx === step;
            const isCompleted = idx < step;
            return (
              <Box key={s.num} onClick={() => isCompleted && setStep(idx)} sx={{
                flex: '1 0 auto', minWidth: 90, padding: { xs: '1rem 0.75rem', sm: '1.5rem' },
                textAlign: 'center', cursor: isCompleted ? 'pointer' : 'default',
                background: isActive ? '#FFF' : 'transparent',
                color: isActive ? '#4F46E5' : isCompleted ? '#10B981' : '#6B7280',
                fontWeight: isActive ? 600 : 400, transition: 'all 0.2s',
                position: 'relative',
                '&::after': isActive ? {
                  content: '""', position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: 3, background: GRAD,
                } : {},
                '&:hover': isCompleted ? { background: '#F3F4F6' } : {},
              }}>
                <Box sx={{
                  width: 32, height: 32, borderRadius: '50%', mx: 'auto', mb: '0.5rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? GRAD : isCompleted ? '#10B981' : '#E5E7EB',
                  color: isActive || isCompleted ? '#FFF' : '#6B7280',
                  fontWeight: 700, fontSize: '0.875rem',
                }}>
                  {isCompleted ? <i className="fas fa-check" style={{ fontSize: '0.7rem' }} /> : s.num}
                </Box>
                <Box sx={{ fontSize: '0.8rem', fontWeight: 'inherit', whiteSpace: 'nowrap', fontFamily: 'Inter,sans-serif' }}>
                  {s.label}
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* ── Step Content ── */}
        <Box sx={{ padding: { xs: '1.5rem', sm: '2rem' } }}>
          {error && (
            <Alert severity="error" sx={{ mb: '1.5rem', borderRadius: '0.5rem' }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* ══════════ STEP 1: POST TYPE ══════════ */}
          {step === 0 && (
            <Box>
              <SectionTitle icon="fa-th-large">Choose Post Type</SectionTitle>
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
                gap: '1rem', mb: '2rem',
              }}>
                {POST_TYPES.map(t => {
                  const active  = postType === t.value;
                  const locked  = ['skill', 'tool'].includes(t.value) && !isVideoVerified;
                  return (
                    <Box key={t.value} onClick={() => setPostType(t.value)} sx={{
                      position: 'relative',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      padding: '2rem 1rem', textAlign: 'center',
                      border: `2px solid ${active ? '#4F46E5' : '#E5E7EB'}`,
                      borderRadius: '0.75rem', cursor: 'pointer',
                      background: active ? 'rgba(79,70,229,0.05)' : 'transparent',
                      boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                      transition: 'all 0.2s',
                      '&:hover': { borderColor: '#4F46E5', transform: 'translateY(-2px)' },
                    }}>
                      {locked && (
                        <Box sx={{
                          position: 'absolute', top: '0.625rem', right: '0.625rem',
                          display: 'flex', alignItems: 'center', gap: '0.2rem',
                          background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)',
                          borderRadius: '0.25rem', padding: '0.15rem 0.35rem',
                        }}>
                          <i className="fas fa-lock" style={{ color: '#D97706', fontSize: '0.6rem' }} />
                          <Box component="span" sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#D97706', fontFamily: 'Inter,sans-serif' }}>
                            VERIFY
                          </Box>
                        </Box>
                      )}
                      <Box sx={{ fontSize: '2rem', color: '#4F46E5', mb: '1rem' }}>
                        <i className={`fas ${t.icon}`} />
                      </Box>
                      <Box sx={{ fontWeight: 600, mb: '0.5rem', fontFamily: 'Inter,sans-serif', color: '#1F2937', fontSize: '0.9375rem' }}>
                        {t.label}
                      </Box>
                      <Box sx={{ fontSize: '0.8125rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', lineHeight: 1.4 }}>
                        {t.desc}
                      </Box>
                    </Box>
                  );
                })}
              </Box>

              {/* Type tip */}
              <Box sx={{
                display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
                padding: '1rem 1.25rem',
                background: 'rgba(79,70,229,0.05)', border: '1px solid rgba(79,70,229,0.15)',
                borderRadius: '0.5rem',
              }}>
                <i className={`fas ${selectedType.icon}`} style={{ color: '#4F46E5', fontSize: '1.25rem', marginTop: 2, flexShrink: 0 }} />
                <Box>
                  <Box sx={{ fontWeight: 600, color: '#1F2937', fontFamily: 'Inter,sans-serif', mb: '0.25rem' }}>
                    {selectedType.label} selected
                  </Box>
                  <Box sx={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                    {selectedType.desc}. {!isEmailVerified ? 'Email verification required to continue.' : !isPhoneVerified ? 'Phone verification required to continue.' : needsVerification ? 'Video verification required to continue.' : 'Click Next Step to fill in the details.'}
                  </Box>
                </Box>
              </Box>

              {/* Email verification gate — required for all post types */}
              {!isEmailVerified && (
                <Box sx={{ mt: '1.5rem' }}>
                  <EmailVerificationGate
                    feature="Creating Posts"
                    description="A verified email address is required before you can post to the community. Check your inbox for a verification link."
                  />
                </Box>
              )}

              {/* Phone verification gate — required for all post types, shown after email verified */}
              {isEmailVerified && !isPhoneVerified && (
                <Box sx={{ mt: '1.5rem' }}>
                  <PhoneVerificationGate
                    feature="Creating Posts"
                    description="A verified mobile number is required before you can post to the community. It takes less than a minute to verify."
                  />
                </Box>
              )}

              {/* Video verification gate — skill / tool types only, shown after both verified */}
              {isEmailVerified && isPhoneVerified && needsVerification && (
                <Box sx={{ mt: '1.5rem' }}>
                  <VideoVerificationGate
                    feature={postType === 'skill' ? 'Skill Posts' : 'Tool Posts'}
                    description={`Posting a ${postType} to the community requires Video Verification so neighbours can trust who they're connecting with.`}
                  />
                </Box>
              )}
            </Box>
          )}

          {/* ══════════ STEP 2: CONTENT ══════════ */}
          {step === 1 && (
            <Box>
              <SectionTitle icon="fa-edit">Post Content</SectionTitle>

              {/* Title */}
              <SkillContainer>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', mb: '1.25rem' }}>
                  <Box sx={{ flex: 1, minWidth: 220 }}>
                    <FormLabel required>{postType === 'tool' ? 'Tool Name' : 'Title'}</FormLabel>
                    {postType === 'tool' ? (
                      <Box ref={toolDropRef} sx={{ position: 'relative' }}>
                        <Box sx={{ position: 'relative' }}>
                          <Box
                            component="input"
                            type="text"
                            value={title}
                            placeholder="Search or type a tool name…"
                            autoComplete="off"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              setTitle(e.target.value);
                              setToolDropOpen(true);
                            }}
                            onFocus={() => setToolDropOpen(true)}
                            onBlur={() => setTimeout(() => setToolDropOpen(false), 150)}
                            sx={{
                              width: '100%', px: '0.875rem', py: '0.5625rem', pr: '2.5rem',
                              border: '1.5px solid #E5E7EB', borderRadius: '0.5rem',
                              fontSize: '0.9375rem', fontFamily: 'Inter,sans-serif', color: '#1F2937',
                              outline: 'none', background: '#FAFAFA', boxSizing: 'border-box',
                              '&:focus': { borderColor: '#4F46E5', background: '#FFF', boxShadow: '0 0 0 3px rgba(79,70,229,0.08)' },
                            }}
                          />
                          <Box sx={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9CA3AF', fontSize: '0.75rem' }}>
                            <i className="fas fa-chevron-down" />
                          </Box>
                        </Box>
                        {toolDropOpen && (() => {
                          const q = title.trim().toLowerCase();
                          const filtered = COMMON_TOOLS.filter(t => !q || t.toLowerCase().includes(q));
                          if (!filtered.length) return null;
                          return (
                            <Box sx={{
                              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
                              background: '#FFF', border: '1.5px solid #E5E7EB', borderRadius: '0.5rem',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.10)', maxHeight: 220, overflowY: 'auto',
                            }}>
                              {filtered.slice(0, 50).map(tool => (
                                <Box
                                  key={tool}
                                  onMouseDown={() => { setTitle(tool); setToolDropOpen(false); }}
                                  sx={{
                                    px: '0.875rem', py: '0.55rem', cursor: 'pointer',
                                    fontSize: '0.9rem', fontFamily: 'Inter,sans-serif', color: '#1F2937',
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    '&:hover': { background: 'rgba(79,70,229,0.06)', color: '#4F46E5' },
                                  }}
                                >
                                  <i className="fas fa-tools" style={{ fontSize: '0.75rem', color: '#9CA3AF', width: 14 }} />
                                  {tool}
                                </Box>
                              ))}
                              {filtered.length > 50 && (
                                <Box sx={{ px: '0.875rem', py: '0.5rem', fontSize: '0.78rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', borderTop: '1px solid #F3F4F6' }}>
                                  Keep typing to narrow results…
                                </Box>
                              )}
                            </Box>
                          );
                        })()}
                      </Box>
                    ) : (
                      <InputBox value={title} onChange={setTitle} placeholder={`Give your ${selectedType.label.toLowerCase()} post a clear title...`} />
                    )}
                    <FormHint icon="fa-info-circle">
                      {postType === 'tool' ? 'Choose from the list or type a custom tool name' : 'Keep it concise and descriptive — this is the first thing people will see'}
                    </FormHint>
                  </Box>

                  {/* Proficiency for skill/tool */}
                  {(postType === 'skill' || postType === 'tool') && (
                    <Box>
                      <FormLabel>
                        {postType === 'skill' ? 'Proficiency Level' : 'Condition'}
                      </FormLabel>
                      <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {(postType === 'skill' ? PROFICIENCY_LEVELS : TOOL_CONDITIONS).map(level => {
                          const isActive = (postType === 'skill' ? proficiency : toolCondition) === level;
                          return (
                            <Box key={level} component="button" type="button"
                              onClick={() => postType === 'skill' ? setProficiency(level) : setToolCondition(level)}
                              sx={{
                                padding: '0.5rem 1rem', border: '1px solid',
                                borderColor: isActive ? 'transparent' : '#E5E7EB',
                                borderRadius: '0.375rem', cursor: 'pointer',
                                background: isActive ? GRAD : '#FFF',
                                color: isActive ? '#FFF' : '#6B7280',
                                fontSize: '0.75rem', fontFamily: 'Inter,sans-serif',
                                fontWeight: isActive ? 600 : 400, transition: 'all 0.2s',
                              }}>
                              {level}
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  )}

                  {/* Category for event/question */}
                  {postType === 'event' && (
                    <Box>
                      <FormLabel>Event Category</FormLabel>
                      <SelectBox value={eventCategory} onChange={setEventCategory}>
                        {EVENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </SelectBox>
                    </Box>
                  )}
                </Box>

                {/* Image upload */}
                <Box sx={{ mb: '1rem' }}>
                  {imageScanError && (
                    <Box sx={{ mb: '0.5rem', px: '0.75rem', py: '0.5rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '0.375rem', fontSize: '0.8125rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <i className="fas fa-exclamation-circle" /> {imageScanError}
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <Box
                      component="label"
                      htmlFor="post-image-upload"
                      sx={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                        px: '0.875rem', py: '0.45rem', borderRadius: '0.375rem',
                        border: '1px dashed #4F46E5', cursor: imageScanning ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem', fontWeight: 500, color: '#4F46E5',
                        background: 'rgba(79,70,229,0.04)',
                        opacity: imageScanning ? 0.6 : 1,
                        '&:hover': { background: imageScanning ? undefined : 'rgba(79,70,229,0.08)' },
                      }}
                    >
                      <i className="fas fa-photo-video" style={{ fontSize: '0.875rem' }} />
                      {imageScanning ? 'Scanning…' : 'Add photos or videos'}
                      <input
                        id="post-image-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,video/ogg"
                        multiple
                        hidden
                        disabled={imageScanning}
                        onChange={async e => {
                          const files = Array.from(e.target.files || []);
                          e.target.value = '';
                          if (!files.length) return;
                          setImageScanError('');
                          // Client-side size gate (100 MB) — instant feedback before any upload
                          const MAX_BYTES = 100 * 1024 * 1024;
                          for (const file of files) {
                            if (file.size > MAX_BYTES) {
                              setImageScanError(`File size exceeded. "${file.name}" is ${(file.size / 1024 / 1024).toFixed(0)} MB — maximum allowed is 100 MB.`);
                              return;
                            }
                          }
                          setImageScanning(true);
                          const safe: File[] = [];
                          for (const file of files) {
                            const result = await scanMedia(file);
                            if (!result.safe) {
                              setImageScanError(`"${file.name}" contains NSFW material and was removed (${result.reason ?? 'explicit content'}).`);
                              setImageScanning(false);
                              return;
                            }
                            safe.push(file);
                          }
                          setImageScanning(false);
                          setPostImages(prev => [...prev, ...safe]);
                        }}
                      />
                    </Box>
                    {imageScanning && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: '#6B7280' }}>
                        <i className="fas fa-spinner fa-spin" style={{ color: '#4F46E5' }} />
                        Checking for NSFW content…
                      </Box>
                    )}
                  </Box>
                  {(existingImages.length > 0 || postImages.length > 0) && (
                    <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', mt: '0.625rem' }}>
                      {/* ── Existing saved images (edit mode) ── */}
                      {existingImages.map((url, i) => {
                        const isVideo = /\.(mp4|mov|webm|ogv)(\?|$)/i.test(url);
                        return (
                          <Box key={`existing-${i}`} sx={{ position: 'relative', width: 72, height: 72 }}>
                            {isVideo ? (
                              <Box sx={{ position: 'relative', width: 72, height: 72 }}>
                                <Box
                                  component="video"
                                  src={url}
                                  preload="metadata"
                                  muted
                                  sx={{ width: 72, height: 72, borderRadius: '0.375rem', objectFit: 'cover', border: '2px solid #4F46E5', display: 'block' }}
                                />
                                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', borderRadius: '0.375rem', pointerEvents: 'none' }}>
                                  <i className="fas fa-play" style={{ color: '#fff', fontSize: '1rem' }} />
                                </Box>
                              </Box>
                            ) : (
                              <Box
                                component="img"
                                src={url}
                                sx={{ width: 72, height: 72, borderRadius: '0.375rem', objectFit: 'cover', border: '2px solid #4F46E5' }}
                              />
                            )}
                            {/* Indigo border = saved; red X to remove */}
                            <Box
                              component="button"
                              type="button"
                              onClick={() => setExistingImages(prev => prev.filter((_, j) => j !== i))}
                              sx={{
                                position: 'absolute', top: -6, right: -6,
                                width: 18, height: 18, borderRadius: '50%',
                                background: '#EF4444', color: '#fff', border: 'none',
                                cursor: 'pointer', fontSize: '0.6rem', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', p: 0,
                              }}
                            >
                              <i className="fas fa-times" />
                            </Box>
                          </Box>
                        );
                      })}
                      {/* ── Newly added files ── */}
                      {postImages.map((file, i) => {
                        const isVideo = file.type.startsWith('video/');
                        const objUrl = URL.createObjectURL(file);
                        return (
                          <Box key={i} sx={{ position: 'relative', width: 72, height: 72 }}>
                            {isVideo ? (
                              <Box sx={{ position: 'relative', width: 72, height: 72 }}>
                                <Box
                                  component="video"
                                  src={objUrl}
                                  preload="metadata"
                                  muted
                                  sx={{ width: 72, height: 72, borderRadius: '0.375rem', objectFit: 'cover', border: '1px solid #E5E7EB', display: 'block' }}
                                />
                                {/* Play icon overlay */}
                                <Box sx={{
                                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  background: 'rgba(0,0,0,0.35)', borderRadius: '0.375rem',
                                  pointerEvents: 'none',
                                }}>
                                  <i className="fas fa-play" style={{ color: '#fff', fontSize: '1rem' }} />
                                </Box>
                              </Box>
                            ) : (
                              <Box
                                component="img"
                                src={objUrl}
                                sx={{ width: 72, height: 72, borderRadius: '0.375rem', objectFit: 'cover', border: '1px solid #E5E7EB' }}
                              />
                            )}
                            <Box
                              component="button"
                              type="button"
                              onClick={() => setPostImages(prev => prev.filter((_, idx) => idx !== i))}
                              sx={{
                                position: 'absolute', top: -6, right: -6,
                                width: 18, height: 18, borderRadius: '50%',
                                background: '#EF4444', color: '#fff', border: 'none',
                                cursor: 'pointer', fontSize: '0.6rem', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', p: 0,
                              }}
                            >
                              <i className="fas fa-times" />
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </Box>

                {/* Content — rich text editor */}
                <FormLabel required>
                  {postType === 'question' ? 'Your Question' : postType === 'event' ? 'Event Description' : 'Description'}
                </FormLabel>
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder={contentPlaceholders[postType] || 'Write your post here...'}
                  minHeight={160}
                  extraToolbar={
                    <Box
                      component="button"
                      type="button"
                      onMouseDown={(e: React.MouseEvent) => {
                        e.preventDefault();
                        document.execCommand('insertText', false, '\n## ');
                      }}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                        px: '0.75rem', py: '0.375rem', borderRadius: '0.375rem',
                        border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer',
                        fontSize: '0.8125rem', fontWeight: 500, color: '#374151',
                        '&:hover': { background: '#F3F4F6', borderColor: '#D1D5DB' },
                      }}
                    >
                      <i className="fas fa-heading" style={{ fontSize: '0.75rem' }} /> Heading
                    </Box>
                  }
                />
                <FormHint icon="fa-info-circle">
                  Use bullet points and headings to make your post easy to read
                </FormHint>
              </SkillContainer>

              {/* ── Market Value + Deposit (tool only) ── */}
              {postType === 'tool' && (() => {
                const depositRate = DEPOSIT_RATES[toolCondition] ?? 0.20;
                const depositUsd  = mvUsd * depositRate;
                const depositCeu  = Math.round(depositUsd);
                const depositDisp = mvRaw > 0 ? `${depositCeu} CEU` : '—';
                return (
                  <>
                    <SectionTitle icon="fa-tag">Market Value &amp; Deposit</SectionTitle>
                    <SkillContainer>

                      {/* Market Value row */}
                      <Box sx={{ mb: '1.5rem' }}>
                        <FormLabel>Second-hand Market Value</FormLabel>
                        <Box sx={{ display: 'flex', gap: '0.5rem', mb: '0.5rem' }}>
                          {/* Currency searchable combobox */}
                          <Box ref={currencyDropRef} sx={{ position: 'relative', flexShrink: 0 }}>
                            <Box
                              onClick={() => { setCurrencyDropOpen(v => !v); setCurrencySearch(''); }}
                              sx={{
                                display: 'flex', alignItems: 'center', gap: '0.375rem',
                                padding: '0.5625rem 0.625rem 0.5625rem 0.75rem',
                                border: '1.5px solid #E5E7EB', borderRadius: '0.5rem',
                                background: '#FAFAFA', cursor: 'pointer', userSelect: 'none',
                                fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', fontFamily: 'Inter,sans-serif',
                                whiteSpace: 'nowrap', minWidth: 80,
                                '&:hover': { borderColor: '#4F46E5' },
                              }}
                            >
                              {userCurrency}
                              <i className="fas fa-chevron-down" style={{ fontSize: '0.6rem', color: '#9CA3AF', marginLeft: 2 }} />
                            </Box>
                            {currencyDropOpen && (() => {
                              const q = currencySearch.trim().toLowerCase();
                              const filtered = ALL_CURRENCIES.filter(c =>
                                !q ||
                                c.code.toLowerCase().includes(q) ||
                                c.name.toLowerCase().includes(q) ||
                                c.sym.toLowerCase().includes(q)
                              );
                              return (
                                <Box sx={{
                                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 60,
                                  width: 280, background: '#FFF', border: '1.5px solid #E5E7EB',
                                  borderRadius: '0.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                                  overflow: 'hidden',
                                }}>
                                  {/* Search input */}
                                  <Box sx={{ p: '0.5rem', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', px: '0.625rem', py: '0.375rem', border: '1.5px solid #E5E7EB', borderRadius: '0.375rem', background: '#FFF',
                                      '&:focus-within': { borderColor: '#4F46E5', boxShadow: '0 0 0 2px rgba(79,70,229,0.08)' } }}>
                                      <i className="fas fa-search" style={{ color: '#9CA3AF', fontSize: '0.7rem', flexShrink: 0 }} />
                                      <Box
                                        component="input"
                                        autoFocus
                                        type="text"
                                        value={currencySearch}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrencySearch(e.target.value)}
                                        placeholder="Search currency…"
                                        sx={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.8125rem', fontFamily: 'Inter,sans-serif', color: '#1F2937', background: 'transparent' }}
                                      />
                                    </Box>
                                  </Box>
                                  {/* Results */}
                                  <Box sx={{ maxHeight: 220, overflowY: 'auto' }}>
                                    {filtered.length === 0 ? (
                                      <Box sx={{ px: '0.875rem', py: '0.625rem', fontSize: '0.8rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif' }}>No currencies found</Box>
                                    ) : filtered.map(c => (
                                      <Box
                                        key={c.code}
                                        onMouseDown={() => { setUserCurrency(c.code); setCurrencyDropOpen(false); setCurrencySearch(''); }}
                                        sx={{
                                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                          px: '0.875rem', py: '0.5rem', cursor: 'pointer',
                                          background: c.code === userCurrency ? 'rgba(79,70,229,0.06)' : 'transparent',
                                          '&:hover': { background: 'rgba(79,70,229,0.06)' },
                                        }}
                                      >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                          <Box sx={{ fontWeight: 700, fontSize: '0.8125rem', color: '#1F2937', fontFamily: 'Inter,sans-serif', minWidth: 36 }}>{c.code}</Box>
                                          <Box sx={{ fontSize: '0.78rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>{c.name}</Box>
                                        </Box>
                                        <Box sx={{ fontSize: '0.8125rem', fontWeight: 600, color: c.code === userCurrency ? '#4F46E5' : '#9CA3AF', fontFamily: 'Inter,sans-serif', ml: '0.5rem' }}>{c.sym}</Box>
                                      </Box>
                                    ))}
                                  </Box>
                                </Box>
                              );
                            })()}
                          </Box>
                          {/* Amount input — symbol as a left addon, never overlapping */}
                          <Box sx={{ flex: 1, display: 'flex', border: '1.5px solid #E5E7EB', borderRadius: '0.5rem', overflow: 'hidden', background: '#FAFAFA',
                            '&:focus-within': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.08)', background: '#FFF' } }}>
                            <Box sx={{ px: '0.75rem', display: 'flex', alignItems: 'center', borderRight: '1px solid #E5E7EB', background: '#F3F4F6', fontSize: '0.875rem', fontWeight: 600, color: '#6B7280', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {sym}
                            </Box>
                            <Box
                              component="input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={toolMarketValue}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToolMarketValue(e.target.value)}
                              placeholder="0.00"
                              sx={{
                                flex: 1, px: '0.875rem', py: '0.5625rem', border: 'none',
                                fontSize: '0.9375rem', fontFamily: 'Inter,sans-serif', color: '#1F2937',
                                outline: 'none', background: 'transparent', minWidth: 0,
                              }}
                            />
                          </Box>
                        </Box>
                        {userCurrency !== 'USD' && mvRaw > 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.78rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                            <i className="fas fa-exchange-alt" style={{ color: '#10B981', fontSize: '0.7rem' }} />
                            {sym}{mvRaw.toFixed(2)} {userCurrency} = <strong style={{ color: '#1F2937' }}>${mvUsd.toFixed(2)} USD</strong>
                          </Box>
                        )}
                        <FormHint icon="fa-info-circle">Current second-hand market rate for this tool</FormHint>
                      </Box>

                      {/* Deposit calculation panel */}
                      <Box>
                        <FormLabel>Deposit Required</FormLabel>
                        <Box sx={{ border: '1px solid rgba(79,70,229,0.18)', borderRadius: '0.625rem', overflow: 'hidden' }}>
                          {/* header */}
                          <Box sx={{ px: '0.875rem', py: '0.4rem', background: 'rgba(79,70,229,0.06)', borderBottom: '1px solid rgba(79,70,229,0.12)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <i className="fas fa-calculator" style={{ color: '#4F46E5', fontSize: '0.7rem' }} />
                            <Box sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Inter,sans-serif', flex: 1 }}>Deposit Calculation</Box>
                            <Box sx={{ fontSize: '0.65rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>auto-calculated</Box>
                          </Box>
                          {/* formula rows */}
                          <Box sx={{ px: '0.875rem', py: '0.5rem', background: '#FAFAFA' }}>
                            {[
                              { icon: 'fa-tag',         label: 'Market Value',      value: mvRaw > 0 ? `${sym}${mvRaw.toFixed(2)}${userCurrency !== 'USD' ? ` ($${mvUsd.toFixed(2)})` : ''}` : '—' },
                              { icon: 'fa-wrench',      label: 'Condition',         value: toolCondition },
                              { icon: 'fa-percent',     label: 'Deposit Rate',      value: `${(depositRate * 100).toFixed(0)}%`, note: toolCondition === 'New' ? 'New tools carry highest value' : toolCondition === 'Excellent' ? 'Excellent condition' : toolCondition === 'Good' ? 'Good condition' : 'Fair condition — lower rate' },
                              { icon: 'fa-equals',      label: 'Deposit',           value: depositDisp, highlight: true },
                            ].map((row, i) => (
                              <Box key={row.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: '0.28rem', borderTop: i === 0 ? 'none' : '1px solid #F3F4F6' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <i className={`fas ${row.icon}`} style={{ color: row.highlight ? '#4F46E5' : '#9CA3AF', fontSize: '0.65rem', width: 12 }} />
                                  <Box sx={{ fontSize: '0.75rem', color: row.highlight ? '#4F46E5' : '#6B7280', fontFamily: 'Inter,sans-serif', fontWeight: row.highlight ? 600 : 400 }}>
                                    {row.label}
                                    {row.note && <Box component="span" sx={{ ml: '0.3rem', color: '#9CA3AF', fontStyle: 'italic', fontSize: '0.68rem' }}>{row.note}</Box>}
                                  </Box>
                                </Box>
                                <Box sx={{ fontSize: row.highlight ? '0.85rem' : '0.75rem', fontWeight: row.highlight ? 700 : 500, color: row.highlight ? '#4F46E5' : '#1F2937', fontFamily: 'Inter,sans-serif' }}>
                                  {row.value}
                                </Box>
                              </Box>
                            ))}
                          </Box>
                          {/* final highlight */}
                          {mvRaw > 0 && (
                            <Box sx={{ px: '0.875rem', py: '0.5rem', background: 'rgba(79,70,229,0.06)', borderTop: '1px solid rgba(79,70,229,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <i className="fas fa-shield-alt" style={{ color: '#4F46E5', fontSize: '0.7rem' }} />
                                <Box sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#4F46E5', fontFamily: 'Inter,sans-serif' }}>Borrower's deposit</Box>
                              </Box>
                              <Box sx={{ fontSize: '1rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Poppins,sans-serif' }}>
                                {depositDisp}
                              </Box>
                            </Box>
                          )}
                          {mvRaw === 0 && (
                            <Box sx={{ px: '0.875rem', py: '0.5rem', background: '#F9FAFB', borderTop: '1px solid #F3F4F6', fontSize: '0.75rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <i className="fas fa-info-circle" /> Enter a market value above to calculate the deposit
                            </Box>
                          )}
                        </Box>
                        <FormHint icon="fa-shield-alt">
                          Deposit held in CEU until the tool is returned in the same condition · New: 30% · Excellent: 25% · Good: 20% · Fair: 15% of market value
                        </FormHint>
                      </Box>

                    </SkillContainer>
                  </>
                );
              })()}

              {/* ── Tool Specifications (tool only) ── */}
              {postType === 'tool' && (
                <>
                  <SectionTitle icon="fa-list-ul">Tool Specifications</SectionTitle>
                  <SkillContainer>

                    {/* Existing categories */}
                    {toolSpecs.map((cat, catIdx) => (
                      <Box key={cat.id} sx={{ mb: '1.25rem', border: '1px solid #E5E7EB', borderRadius: '0.625rem', overflow: 'hidden' }}>
                        {/* Category header */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: '0.875rem', py: '0.5rem', background: 'rgba(79,70,229,0.05)', borderBottom: '1px solid #E5E7EB' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <i className="fas fa-tag" style={{ color: '#4F46E5', fontSize: '0.7rem' }} />
                            <Box sx={{ fontWeight: 700, fontSize: '0.8125rem', color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>{cat.name}</Box>
                          </Box>
                          <Box component="button" type="button" onClick={() => setToolSpecs(prev => prev.filter((_, i) => i !== catIdx))}
                            sx={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '0.75rem', p: '0.125rem 0.25rem', borderRadius: '0.25rem', '&:hover': { color: '#EF4444', background: '#FEE2E2' } }}>
                            <i className="fas fa-times" />
                          </Box>
                        </Box>

                        {/* Detail lines */}
                        <Box sx={{ px: '0.875rem', pt: '0.5rem', pb: '0.625rem', background: '#FAFAFA' }}>
                          {cat.details.map((detail, dIdx) => (
                            <Box key={dIdx} sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', py: '0.25rem' }}>
                              <i className="fas fa-circle" style={{ color: '#4F46E5', fontSize: '0.35rem', flexShrink: 0 }} />
                              <Box sx={{ flex: 1, fontSize: '0.8125rem', color: '#374151', fontFamily: 'Inter,sans-serif' }}>{detail}</Box>
                              <Box component="button" type="button"
                                onClick={() => setToolSpecs(prev => prev.map((c, ci) => ci !== catIdx ? c : { ...c, details: c.details.filter((_, di) => di !== dIdx) }))}
                                sx={{ border: 'none', background: 'none', cursor: 'pointer', color: '#D1D5DB', fontSize: '0.65rem', p: '0.125rem', '&:hover': { color: '#EF4444' } }}>
                                <i className="fas fa-times" />
                              </Box>
                            </Box>
                          ))}

                          {/* Add detail input */}
                          <Box sx={{ display: 'flex', gap: '0.5rem', mt: cat.details.length > 0 ? '0.5rem' : '0', pt: cat.details.length > 0 ? '0.5rem' : '0', borderTop: cat.details.length > 0 ? '1px dashed #E5E7EB' : 'none' }}>
                            <Box
                              component="input"
                              type="text"
                              value={cat.newDetail}
                              placeholder={`Add a detail for ${cat.name}…`}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setToolSpecs(prev => prev.map((c, ci) => ci !== catIdx ? c : { ...c, newDetail: e.target.value }))
                              }
                              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                if (e.key === 'Enter' && cat.newDetail.trim()) {
                                  e.preventDefault();
                                  setToolSpecs(prev => prev.map((c, ci) => ci !== catIdx ? c : { ...c, details: [...c.details, c.newDetail.trim()], newDetail: '' }));
                                }
                              }}
                              sx={{
                                flex: 1, px: '0.625rem', py: '0.375rem',
                                border: '1px solid #E5E7EB', borderRadius: '0.375rem',
                                fontSize: '0.8125rem', fontFamily: 'Inter,sans-serif', color: '#1F2937',
                                outline: 'none', background: '#FFF',
                                '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 2px rgba(79,70,229,0.08)' },
                              }}
                            />
                            <Box component="button" type="button"
                              onClick={() => {
                                if (!cat.newDetail.trim()) return;
                                setToolSpecs(prev => prev.map((c, ci) => ci !== catIdx ? c : { ...c, details: [...c.details, c.newDetail.trim()], newDetail: '' }));
                              }}
                              sx={{ px: '0.625rem', py: '0.375rem', background: GRAD, color: '#FFF', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap', '&:hover': { opacity: 0.88 } }}>
                              + Add
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    ))}

                    {/* Add category — single combobox: type to filter presets OR add any custom name */}
                    {(() => {
                      const addCat = (name: string) => {
                        const n = name.trim();
                        if (!n) return;
                        setToolSpecs(prev => [...prev, { id: String(Date.now()), name: n, details: [], newDetail: '' }]);
                        setSpecCatInput('');
                        setSpecPresetOpen(false);
                      };
                      const q = specCatInput.trim().toLowerCase();
                      const suggestions = SPEC_PRESETS.filter(p =>
                        !toolSpecs.some(s => s.name === p) &&
                        (!q || p.toLowerCase().includes(q))
                      );
                      const isExactPreset = SPEC_PRESETS.some(p => p.toLowerCase() === q);
                      return (
                        <Box sx={{ position: 'relative', maxWidth: 320 }}>
                          <Box sx={{
                            display: 'flex', alignItems: 'center',
                            border: `1.5px solid ${specPresetOpen ? '#4F46E5' : '#E5E7EB'}`,
                            borderRadius: '0.5rem', overflow: 'visible',
                            background: '#FFF',
                            boxShadow: specPresetOpen ? '0 0 0 3px rgba(79,70,229,0.08)' : 'none',
                            transition: 'border-color 0.15s, box-shadow 0.15s',
                          }}>
                            <i className="fas fa-plus" style={{ color: '#4F46E5', fontSize: '0.7rem', paddingLeft: '0.75rem', flexShrink: 0 }} />
                            <Box
                              component="input"
                              type="text"
                              value={specCatInput}
                              placeholder="Add category — choose preset or type custom…"
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                setSpecCatInput(e.target.value);
                                setSpecPresetOpen(true);
                              }}
                              onFocus={() => setSpecPresetOpen(true)}
                              onBlur={() => setTimeout(() => setSpecPresetOpen(false), 150)}
                              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                if (e.key === 'Enter') { e.preventDefault(); addCat(specCatInput); }
                                if (e.key === 'Escape') { setSpecCatInput(''); setSpecPresetOpen(false); }
                              }}
                              sx={{
                                flex: 1, px: '0.625rem', py: '0.5rem',
                                border: 'none', outline: 'none', background: 'transparent',
                                fontSize: '0.8125rem', fontFamily: 'Inter,sans-serif', color: '#1F2937',
                                '&::placeholder': { color: '#9CA3AF' },
                              }}
                            />
                            {specCatInput && (
                              <Box component="button" type="button"
                                onMouseDown={() => { setSpecCatInput(''); setSpecPresetOpen(false); }}
                                sx={{ px: '0.5rem', border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '0.65rem', '&:hover': { color: '#6B7280' } }}>
                                <i className="fas fa-times" />
                              </Box>
                            )}
                            <Box component="button" type="button"
                              onMouseDown={() => addCat(specCatInput)}
                              sx={{ px: '0.75rem', py: '0.5rem', background: GRAD, color: '#FFF', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.2)', cursor: specCatInput.trim() ? 'pointer' : 'default', opacity: specCatInput.trim() ? 1 : 0.45, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap', transition: 'opacity 0.15s' }}>
                              Add
                            </Box>
                          </Box>

                          {/* Dropdown: presets + optional "Add custom" row */}
                          {specPresetOpen && (suggestions.length > 0 || (q && !isExactPreset)) && (
                            <Box sx={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, background: '#FFF', border: '1.5px solid #E5E7EB', borderRadius: '0.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.10)', overflow: 'hidden' }}>
                              {suggestions.length > 0 && (
                                <Box sx={{ px: '0.75rem', pt: '0.4rem', pb: '0.25rem' }}>
                                  <Box sx={{ fontSize: '0.67rem', fontWeight: 700, color: '#9CA3AF', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Suggestions</Box>
                                </Box>
                              )}
                              {suggestions.map(preset => (
                                <Box key={preset}
                                  onMouseDown={() => addCat(preset)}
                                  sx={{ px: '0.875rem', py: '0.45rem', cursor: 'pointer', fontSize: '0.8125rem', color: '#1F2937', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.5rem', '&:hover': { background: 'rgba(79,70,229,0.06)', color: '#4F46E5' } }}>
                                  <i className="fas fa-tag" style={{ fontSize: '0.6rem', color: '#9CA3AF', width: 10 }} />
                                  {preset}
                                </Box>
                              ))}
                              {q && !isExactPreset && (
                                <Box
                                  onMouseDown={() => addCat(specCatInput)}
                                  sx={{ px: '0.875rem', py: '0.45rem', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.5rem', borderTop: suggestions.length > 0 ? '1px solid #F3F4F6' : 'none', background: '#FAFAFA', '&:hover': { background: 'rgba(79,70,229,0.06)' } }}>
                                  <i className="fas fa-plus" style={{ fontSize: '0.6rem', color: '#4F46E5', width: 10 }} />
                                  <Box sx={{ color: '#4F46E5', fontWeight: 600 }}>Add custom: </Box>
                                  <Box sx={{ color: '#1F2937' }}>"{specCatInput.trim()}"</Box>
                                </Box>
                              )}
                            </Box>
                          )}
                        </Box>
                      );
                    })()}

                    {toolSpecs.length === 0 && (
                      <FormHint icon="fa-info-circle">
                        Add categories like Fuel Type, Weight, or Maintenance to give borrowers important details about your tool
                      </FormHint>
                    )}

                  </SkillContainer>
                </>
              )}

              {/* ── Event Resources (event only) ── */}
              {postType === 'event' && (
                <>
                  <SectionTitle icon="fa-list-ul">Event Resources</SectionTitle>
                  <SkillContainer>

                    {/* Existing resource categories */}
                    {eventResources.map((cat, catIdx) => (
                      <Box key={cat.id} sx={{ mb: '1.25rem', border: '1px solid #E5E7EB', borderRadius: '0.625rem', overflow: 'hidden' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: '0.875rem', py: '0.5rem', background: 'rgba(79,70,229,0.05)', borderBottom: '1px solid #E5E7EB' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <i className="fas fa-tag" style={{ color: '#4F46E5', fontSize: '0.7rem' }} />
                            <Box sx={{ fontWeight: 700, fontSize: '0.8125rem', color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>{cat.name}</Box>
                          </Box>
                          <Box component="button" type="button" onClick={() => setEventResources(prev => prev.filter((_, i) => i !== catIdx))}
                            sx={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '0.75rem', p: '0.125rem 0.25rem', borderRadius: '0.25rem', '&:hover': { color: '#EF4444', background: '#FEE2E2' } }}>
                            <i className="fas fa-times" />
                          </Box>
                        </Box>

                        <Box sx={{ px: '0.875rem', pt: '0.5rem', pb: '0.625rem', background: '#FAFAFA' }}>
                          {cat.details.map((detail, dIdx) => (
                            <Box key={dIdx} sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', py: '0.25rem' }}>
                              <i className="fas fa-circle" style={{ color: '#4F46E5', fontSize: '0.35rem', flexShrink: 0 }} />
                              <Box sx={{ flex: 1, fontSize: '0.8125rem', color: '#374151', fontFamily: 'Inter,sans-serif' }}>{detail}</Box>
                              <Box component="button" type="button"
                                onClick={() => setEventResources(prev => prev.map((c, ci) => ci !== catIdx ? c : { ...c, details: c.details.filter((_, di) => di !== dIdx) }))}
                                sx={{ border: 'none', background: 'none', cursor: 'pointer', color: '#D1D5DB', fontSize: '0.65rem', p: '0.125rem', '&:hover': { color: '#EF4444' } }}>
                                <i className="fas fa-times" />
                              </Box>
                            </Box>
                          ))}

                          <Box sx={{ display: 'flex', gap: '0.5rem', mt: cat.details.length > 0 ? '0.5rem' : '0', pt: cat.details.length > 0 ? '0.5rem' : '0', borderTop: cat.details.length > 0 ? '1px dashed #E5E7EB' : 'none' }}>
                            <Box
                              component="input"
                              type="text"
                              value={cat.newDetail}
                              placeholder={`Add a detail for ${cat.name}…`}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setEventResources(prev => prev.map((c, ci) => ci !== catIdx ? c : { ...c, newDetail: e.target.value }))
                              }
                              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                if (e.key === 'Enter' && cat.newDetail.trim()) {
                                  e.preventDefault();
                                  setEventResources(prev => prev.map((c, ci) => ci !== catIdx ? c : { ...c, details: [...c.details, c.newDetail.trim()], newDetail: '' }));
                                }
                              }}
                              sx={{
                                flex: 1, px: '0.625rem', py: '0.375rem',
                                border: '1px solid #E5E7EB', borderRadius: '0.375rem',
                                fontSize: '0.8125rem', fontFamily: 'Inter,sans-serif', color: '#1F2937',
                                outline: 'none', background: '#FFF',
                                '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 2px rgba(79,70,229,0.08)' },
                              }}
                            />
                            <Box component="button" type="button"
                              onClick={() => {
                                if (!cat.newDetail.trim()) return;
                                setEventResources(prev => prev.map((c, ci) => ci !== catIdx ? c : { ...c, details: [...c.details, c.newDetail.trim()], newDetail: '' }));
                              }}
                              sx={{ px: '0.625rem', py: '0.375rem', background: GRAD, color: '#FFF', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap', '&:hover': { opacity: 0.88 } }}>
                              + Add
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    ))}

                    {/* Add resource category combobox */}
                    {(() => {
                      const addCat = (name: string) => {
                        const n = name.trim();
                        if (!n) return;
                        setEventResources(prev => [...prev, { id: String(Date.now()), name: n, details: [], newDetail: '' }]);
                        setResCatInput('');
                        setResPresetOpen(false);
                      };
                      const q = resCatInput.trim().toLowerCase();
                      const suggestions = EVENT_RESOURCE_PRESETS.filter(p =>
                        !eventResources.some(s => s.name === p) &&
                        (!q || p.toLowerCase().includes(q))
                      );
                      const isExactPreset = EVENT_RESOURCE_PRESETS.some(p => p.toLowerCase() === q);
                      return (
                        <Box sx={{ position: 'relative', maxWidth: 320 }}>
                          <Box sx={{
                            display: 'flex', alignItems: 'center',
                            border: `1.5px solid ${resPresetOpen ? '#4F46E5' : '#E5E7EB'}`,
                            borderRadius: '0.5rem', overflow: 'visible',
                            background: '#FFF',
                            boxShadow: resPresetOpen ? '0 0 0 3px rgba(79,70,229,0.08)' : 'none',
                            transition: 'border-color 0.15s, box-shadow 0.15s',
                          }}>
                            <i className="fas fa-plus" style={{ color: '#4F46E5', fontSize: '0.7rem', paddingLeft: '0.75rem', flexShrink: 0 }} />
                            <Box
                              component="input"
                              type="text"
                              value={resCatInput}
                              placeholder="Add category — choose preset or type custom…"
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                setResCatInput(e.target.value);
                                setResPresetOpen(true);
                              }}
                              onFocus={() => setResPresetOpen(true)}
                              onBlur={() => setTimeout(() => setResPresetOpen(false), 150)}
                              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                if (e.key === 'Enter') { e.preventDefault(); addCat(resCatInput); }
                                if (e.key === 'Escape') { setResCatInput(''); setResPresetOpen(false); }
                              }}
                              sx={{
                                flex: 1, px: '0.625rem', py: '0.5rem',
                                border: 'none', outline: 'none', background: 'transparent',
                                fontSize: '0.8125rem', fontFamily: 'Inter,sans-serif', color: '#1F2937',
                                '&::placeholder': { color: '#9CA3AF' },
                              }}
                            />
                            {resCatInput && (
                              <Box component="button" type="button"
                                onMouseDown={() => { setResCatInput(''); setResPresetOpen(false); }}
                                sx={{ px: '0.5rem', border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '0.65rem', '&:hover': { color: '#6B7280' } }}>
                                <i className="fas fa-times" />
                              </Box>
                            )}
                            <Box component="button" type="button"
                              onMouseDown={() => addCat(resCatInput)}
                              sx={{ px: '0.75rem', py: '0.5rem', background: GRAD, color: '#FFF', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.2)', cursor: resCatInput.trim() ? 'pointer' : 'default', opacity: resCatInput.trim() ? 1 : 0.45, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap', transition: 'opacity 0.15s' }}>
                              Add
                            </Box>
                          </Box>

                          {resPresetOpen && (suggestions.length > 0 || (q && !isExactPreset)) && (
                            <Box sx={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, background: '#FFF', border: '1.5px solid #E5E7EB', borderRadius: '0.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.10)', overflow: 'hidden' }}>
                              {suggestions.length > 0 && (
                                <Box sx={{ px: '0.75rem', pt: '0.4rem', pb: '0.25rem' }}>
                                  <Box sx={{ fontSize: '0.67rem', fontWeight: 700, color: '#9CA3AF', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Suggestions</Box>
                                </Box>
                              )}
                              {suggestions.map(preset => (
                                <Box key={preset}
                                  onMouseDown={() => addCat(preset)}
                                  sx={{ px: '0.875rem', py: '0.45rem', cursor: 'pointer', fontSize: '0.8125rem', color: '#1F2937', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.5rem', '&:hover': { background: 'rgba(79,70,229,0.06)', color: '#4F46E5' } }}>
                                  <i className="fas fa-tag" style={{ fontSize: '0.6rem', color: '#9CA3AF', width: 10 }} />
                                  {preset}
                                </Box>
                              ))}
                              {q && !isExactPreset && (
                                <Box
                                  onMouseDown={() => addCat(resCatInput)}
                                  sx={{ px: '0.875rem', py: '0.45rem', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.5rem', borderTop: suggestions.length > 0 ? '1px solid #F3F4F6' : 'none', background: '#FAFAFA', '&:hover': { background: 'rgba(79,70,229,0.06)' } }}>
                                  <i className="fas fa-plus" style={{ fontSize: '0.6rem', color: '#4F46E5', width: 10 }} />
                                  <Box sx={{ color: '#4F46E5', fontWeight: 600 }}>Add custom: </Box>
                                  <Box sx={{ color: '#1F2937' }}>"{resCatInput.trim()}"</Box>
                                </Box>
                              )}
                            </Box>
                          )}
                        </Box>
                      );
                    })()}

                    {eventResources.length === 0 && (
                      <FormHint icon="fa-info-circle">
                        Add resource categories like What to Bring, Schedule / Agenda, or Parking & Transit to help attendees prepare
                      </FormHint>
                    )}

                  </SkillContainer>
                </>
              )}

              {/* ── Group Size / Requirements / Language ── */}
              {postType !== 'tool' && postType !== 'event' && postType !== 'question' && <SectionTitle icon="fa-users">Session Details</SectionTitle>}
              {postType !== 'tool' && postType !== 'event' && postType !== 'question' && <SkillContainer>

                {/* Group Size */}
                <Box sx={{ mb: '1.75rem' }}>
                  <FormLabel>
                    Group Size{' '}
                    <Box component="span" sx={{ fontWeight: 400, color: '#9CA3AF', fontSize: '0.8rem' }}>(max members)</Box>
                  </FormLabel>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.375rem', mt: '0.625rem' }}>
                    {([null, ...Array.from({ length: 12 }, (_, i) => i + 1)] as (number | null)[]).map((n) => {
                      const isActive = groupSize === n;
                      return (
                        <Box
                          key={n ?? 'any'}
                          component="button"
                          type="button"
                          onClick={() => setGroupSize(isActive ? null : n)}
                          sx={{
                            px: '0.875rem', py: '0.4rem',
                            border: '1.5px solid', borderColor: isActive ? 'transparent' : '#E5E7EB',
                            borderRadius: '0.5rem', cursor: 'pointer',
                            background: isActive ? GRAD : '#FAFAFA',
                            color: isActive ? '#FFF' : '#374151',
                            fontSize: '0.8125rem', fontFamily: 'Inter,sans-serif',
                            fontWeight: isActive ? 600 : 400, transition: 'all 0.15s',
                            '&:hover': { borderColor: '#4F46E5', background: isActive ? GRAD : 'rgba(79,70,229,0.04)' },
                          }}
                        >
                          {n === null ? 'Any size' : n === 1 ? '1 person' : `${n} people`}
                        </Box>
                      );
                    })}
                  </Box>
                  <FormHint icon="fa-info-circle">
                    How many people can join this {selectedType.label.toLowerCase()}? Leave unset for any size.
                  </FormHint>
                </Box>

                {/* Requirements */}
                <Box sx={{ mb: '1.75rem' }}>
                  <FormLabel>Requirements</FormLabel>
                  <Box sx={{ display: 'flex', gap: '0.5rem', mt: '0.5rem' }}>
                    <Box
                      component="input"
                      type="text"
                      placeholder="e.g. Bring a notebook, wear comfortable shoes…"
                      value={reqInput}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReqInput(e.target.value)}
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if ((e.key === 'Enter' || e.key === ',') && reqInput.trim()) {
                          e.preventDefault();
                          const val = reqInput.trim().replace(/,$/, '');
                          if (val && !requirements.includes(val) && requirements.length < 10) {
                            setRequirements(prev => [...prev, val]);
                          }
                          setReqInput('');
                        }
                      }}
                      sx={{
                        flex: 1, px: '0.875rem', py: '0.5rem',
                        border: '1.5px solid #E5E7EB', borderRadius: '0.5rem',
                        fontSize: '0.9375rem', fontFamily: 'Inter,sans-serif', color: '#1F2937',
                        outline: 'none', background: '#FAFAFA',
                        '&:focus': { borderColor: '#4F46E5', background: '#FFF', boxShadow: '0 0 0 3px rgba(79,70,229,0.08)' },
                      }}
                    />
                    <Box
                      component="button"
                      type="button"
                      onClick={() => {
                        const val = reqInput.trim().replace(/,$/, '');
                        if (val && !requirements.includes(val) && requirements.length < 10) {
                          setRequirements(prev => [...prev, val]);
                        }
                        setReqInput('');
                      }}
                      sx={{
                        px: '1rem', py: '0.5rem', borderRadius: '0.5rem',
                        background: GRAD, color: '#FFF', border: 'none', cursor: 'pointer',
                        fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Inter,sans-serif',
                        transition: 'opacity 0.15s', '&:hover': { opacity: 0.88 },
                      }}
                    >
                      Add
                    </Box>
                  </Box>
                  {requirements.length > 0 && (
                    <Box sx={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', mt: '0.625rem' }}>
                      {requirements.map((req, i) => (
                        <Box key={i} sx={{
                          display: 'flex', alignItems: 'center', gap: '0.375rem',
                          px: '0.625rem', py: '0.3rem',
                          background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.2)',
                          borderRadius: '2rem', fontSize: '0.8125rem', fontFamily: 'Inter,sans-serif', color: '#4F46E5',
                        }}>
                          {req}
                          <Box
                            component="button"
                            type="button"
                            onClick={() => setRequirements(prev => prev.filter((_, j) => j !== i))}
                            sx={{
                              background: 'none', border: 'none', cursor: 'pointer', p: 0,
                              color: '#6B7280', display: 'flex', alignItems: 'center',
                              '&:hover': { color: '#EF4444' },
                            }}
                          >
                            <i className="fas fa-times" style={{ fontSize: '0.6rem' }} />
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                  <FormHint icon="fa-info-circle">
                    Press Enter or comma to add — max 10 items
                  </FormHint>
                </Box>

                {/* Language */}
                <Box>
                  <FormLabel>
                    Language{' '}
                    <Box component="span" sx={{ fontWeight: 400, color: '#9CA3AF', fontSize: '0.8rem' }}>(select up to 2)</Box>
                  </FormLabel>
                  <Box sx={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', mt: '0.625rem' }}>
                    {LANGUAGES.map(lang => {
                      const selected = languages.includes(lang);
                      const disabled = !selected && languages.length >= 2;
                      return (
                        <Box
                          key={lang}
                          component="button"
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            if (selected) {
                              setLanguages(prev => prev.filter(l => l !== lang));
                            } else if (languages.length < 2) {
                              setLanguages(prev => [...prev, lang]);
                            }
                          }}
                          sx={{
                            px: '0.75rem', py: '0.35rem',
                            border: '1.5px solid', borderColor: selected ? 'transparent' : '#E5E7EB',
                            borderRadius: '0.5rem', cursor: disabled ? 'not-allowed' : 'pointer',
                            background: selected ? GRAD : '#FAFAFA',
                            color: selected ? '#FFF' : disabled ? '#C0C0C0' : '#374151',
                            fontSize: '0.8rem', fontFamily: 'Inter,sans-serif',
                            fontWeight: selected ? 600 : 400, transition: 'all 0.15s',
                            opacity: disabled ? 0.45 : 1,
                            '&:hover': disabled ? {} : {
                              borderColor: '#4F46E5',
                              background: selected ? GRAD : 'rgba(79,70,229,0.04)',
                            },
                          }}
                        >
                          {lang}
                        </Box>
                      );
                    })}
                  </Box>
                  {languages.length === 2 && (
                    <Box sx={{ mt: '0.5rem', fontSize: '0.8rem', color: '#10B981', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <i className="fas fa-check-circle" /> Maximum 2 languages selected
                    </Box>
                  )}
                  <FormHint icon="fa-info-circle">
                    Which language(s) will you offer this {selectedType.label.toLowerCase()} in?
                  </FormHint>
                </Box>

              </SkillContainer>}
            </Box>
          )}

          {/* ══════════ STEP 3: DETAILS ══════════ */}
          {step === 2 && (
            <Box>

              {/* ── Exchange Type (tool only) ── */}
              {postType === 'tool' && (
                <>
                  <SectionTitle icon="fa-exchange-alt">Exchange Type</SectionTitle>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '1rem', mb: '1.5rem' }}>
                    {([
                      { type: 'borrow',    icon: 'fa-tools',   label: 'Borrow',            desc: 'Temporary use' },
                      { type: 'permanent', icon: 'fa-retweet', label: 'Permanent Exchange', desc: 'Full ownership transfer' },
                    ] as { type: 'borrow'|'permanent'; icon: string; label: string; desc: string }[]).map(opt => {
                      const active = toolExchangeType === opt.type;
                      return (
                        <Box key={opt.type} onClick={() => setToolExchangeType(toolExchangeType === opt.type ? null : opt.type)} sx={{
                          display: 'flex', alignItems: 'center', gap: '0.875rem',
                          padding: '0.875rem 1.25rem', cursor: 'pointer',
                          border: `1.5px solid ${active ? '#4F46E5' : '#E5E7EB'}`,
                          borderRadius: '0.75rem',
                          background: active ? 'rgba(79,70,229,0.04)' : '#FAFAFA',
                          transition: 'all 0.2s',
                          '&:hover': { borderColor: '#4F46E5', background: 'rgba(79,70,229,0.04)' },
                        }}>
                          <Box sx={{
                            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: active ? 'rgba(79,70,229,0.12)' : '#F3F4F6',
                            transition: 'background 0.2s',
                          }}>
                            <i className={`fas ${opt.icon}`} style={{ fontSize: '0.9rem', color: active ? '#4F46E5' : '#9CA3AF' }} />
                          </Box>
                          <Box>
                            <Box sx={{ fontWeight: 600, fontSize: '0.9rem', fontFamily: 'Inter,sans-serif', color: active ? '#4F46E5' : '#1F2937', transition: 'color 0.2s' }}>
                              {opt.label}
                            </Box>
                            <Box sx={{ fontSize: '0.78rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', mt: '1px' }}>
                              {opt.desc}
                            </Box>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </>
              )}

              {/* ── Location (skill/tool/general; not event/question) ── */}
              {postType !== 'event' && postType !== 'question' && (postType !== 'tool' || toolExchangeType !== null) && (
                <CollapsibleSection icon="fa-map-marker-alt" title="Exchange Location" open={showLocation} onToggle={() => setShowLocation(v => !v)}>
                  {/* Location type cards — hidden when online is enabled */}
                  {!(onlineVideo || onlineOnly) && (
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '1rem', mb: '1.5rem' }}>
                      {[
                        { key: 'public',  icon: 'fa-store', label: 'Public Place',     desc: 'Meet at a cafe, library, community center, or other public location' },
                        { key: 'private', icon: 'fa-home',  label: 'Private Location', desc: 'Home or private location (requires secure sharing)' },
                      ].map(loc => {
                        const active = locType === loc.key;
                        return (
                          <Box key={loc.key} onClick={() => {
                              const next = loc.key as typeof locType;
                              setLocType(next);
                              if (next === 'public') setPrivatePlace('');
                              else setPublicPlace('');
                            }} sx={{
                            padding: '1.5rem', cursor: 'pointer',
                            border: `2px solid ${active ? '#4F46E5' : '#E5E7EB'}`,
                            borderRadius: '0.75rem',
                            background: active ? 'rgba(79,70,229,0.05)' : 'transparent',
                            transition: 'all 0.2s',
                            '&:hover': { borderColor: '#4F46E5', transform: 'translateY(-2px)' },
                          }}>
                            <Box sx={{ fontSize: '1.5rem', color: '#4F46E5', mb: '1rem' }}>
                              <i className={`fas ${loc.icon}`} />
                            </Box>
                            <Box sx={{ fontWeight: 600, mb: '0.5rem', fontFamily: 'Inter,sans-serif', color: '#1F2937' }}>
                              {loc.label}
                            </Box>
                            <Box sx={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                              {loc.desc}
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  )}

                  {/* Public place picker */}
                  {!(onlineVideo || onlineOnly) && locType === 'public' && (
                    <SkillContainer>
                      <FormLabel>Public Place Selection</FormLabel>
                      <PublicPlacePicker
                        value={publicPlace}
                        onChange={setPublicPlace}
                        userCoordinates={
                          user?.location?.coordinates &&
                          (user.location.coordinates as number[])[0] !== 0 &&
                          (user.location.coordinates as number[])[1] !== 0
                            ? (user.location.coordinates as [number, number])
                            : undefined
                        }
                      />
                      <FormHint icon="fa-shield-alt">
                        Search or click a pin on the map — public locations are recommended for safety
                      </FormHint>
                    </SkillContainer>
                  )}

                  {/* Private location picker */}
                  {!(onlineVideo || onlineOnly) && locType === 'private' && (
                    <>
                      <SkillContainer>
                        <FormLabel>Exchange Location Selection</FormLabel>
                        <PublicPlacePicker
                          value={privatePlace}
                          onChange={setPrivatePlace}
                          userCoordinates={
                            user?.location?.coordinates &&
                            (user.location.coordinates as number[])[0] !== 0 &&
                            (user.location.coordinates as number[])[1] !== 0
                              ? (user.location.coordinates as [number, number])
                              : undefined
                          }
                        />
                        <FormHint icon="fa-lock">
                          Your exact location will only be shared securely after both parties confirm — the community sees a masked address
                        </FormHint>
                      </SkillContainer>

                      {/* Security warning */}
                      <Box sx={{
                        background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(245,158,11,0.1))',
                        border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: '0.75rem', padding: '1.5rem', mb: '1.5rem',
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', mb: '0.75rem' }}>
                          <i className="fas fa-exclamation-triangle" style={{ color: '#EF4444', fontSize: '1.25rem' }} />
                          <Box sx={{ fontWeight: 600, color: '#EF4444', fontFamily: 'Poppins,sans-serif' }}>
                            Important Security Notice
                          </Box>
                        </Box>
                        {[
                          'Your exact address will never be stored in chat logs',
                          'Location will be shared via one-time secure link only',
                          'Links expire automatically after the meeting time',
                          'All location access is logged for security monitoring',
                        ].map(item => (
                          <Box key={item} sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', mb: '0.5rem' }}>
                            <i className="fas fa-check-circle" style={{ color: '#F59E0B', marginTop: 2, fontSize: '0.8rem', flexShrink: 0 }} />
                            <Box sx={{ fontSize: '0.875rem', color: '#374151', fontFamily: 'Inter,sans-serif' }}>{item}</Box>
                          </Box>
                        ))}
                      </Box>

                    </>
                  )}


                  {/* Online Option — inside Exchange Location (hidden for tool posts) */}
                  {postType !== 'tool' && (
                  <Box sx={{ mt: '1.5rem' }}>
                    <Box
                      onClick={() => {
                        const next = !(onlineVideo || onlineOnly);
                        setOnlineVideo(next);
                        setOnlineOnly(next);
                        if (!next) { setVideoLink(''); setVideoToken(''); setVideoCopied(false); }
                      }}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: '1rem',
                        padding: '1rem 1.25rem', borderRadius: '0.75rem', cursor: 'pointer',
                        border: (onlineVideo || onlineOnly) ? '1.5px solid rgba(79,70,229,0.35)' : '1.5px solid #E5E7EB',
                        background: (onlineVideo || onlineOnly)
                          ? 'linear-gradient(135deg, rgba(79,70,229,0.05) 0%, rgba(16,185,129,0.05) 100%)'
                          : '#FAFAFA',
                        transition: 'all 0.2s', userSelect: 'none',
                        '&:hover': {
                          borderColor: '#4F46E5',
                          background: 'linear-gradient(135deg, rgba(79,70,229,0.05) 0%, rgba(16,185,129,0.05) 100%)',
                        },
                      }}
                    >
                      <Box sx={{
                        width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                        background: (onlineVideo || onlineOnly) ? GRAD : '#F3F4F6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s',
                        boxShadow: (onlineVideo || onlineOnly) ? '0 3px 10px rgba(79,70,229,0.3)' : 'none',
                      }}>
                        <i className="fas fa-video" style={{ fontSize: '1rem', color: (onlineVideo || onlineOnly) ? '#FFF' : '#9CA3AF' }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ fontSize: '0.9rem', fontWeight: 600, color: (onlineVideo || onlineOnly) ? '#4F46E5' : '#374151', fontFamily: 'Inter,sans-serif', transition: 'color 0.2s' }}>
                          This post can be done online
                        </Box>
                        <Box sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', mt: '2px' }}>
                          {(onlineVideo || onlineOnly) ? 'Video call enabled — create your meeting link below' : 'Enable to offer a video call option to participants'}
                        </Box>
                      </Box>
                      <Box sx={{
                        width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                        background: (onlineVideo || onlineOnly) ? GRAD : '#D1D5DB',
                        position: 'relative', transition: 'background 0.25s',
                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.12)',
                      }}>
                        <Box sx={{
                          position: 'absolute', top: 3,
                          left: (onlineVideo || onlineOnly) ? 23 : 3,
                          width: 18, height: 18, borderRadius: '50%', background: '#FFF',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
                          transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1)',
                        }} />
                      </Box>
                    </Box>

                    {/* Video link creator */}
                    {(onlineVideo || onlineOnly) && (
                      <Box sx={{ mt: '1.25rem', border: '1px solid #E5E7EB', borderRadius: '0.75rem', overflow: 'hidden' }}>
                        <Box sx={{ background: GRAD, padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                          <i className="fas fa-video" style={{ color: '#FFF', fontSize: '0.9rem' }} />
                          <Box sx={{ fontWeight: 600, color: '#FFF', fontSize: '0.9rem', fontFamily: 'Poppins,sans-serif' }}>
                            Video Meeting Link
                          </Box>
                        </Box>
                        <Box sx={{ padding: '1.25rem', background: '#FAFAFA' }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', mb: '0.75rem', p: '0.625rem 0.875rem', background: 'rgba(79,70,229,0.05)', borderRadius: '0.5rem', border: '1px solid rgba(79,70,229,0.15)' }}>
                            <i className="fas fa-shield-alt" style={{ color: '#4F46E5', fontSize: '0.75rem', marginTop: '2px', flexShrink: 0 }} />
                            <Box sx={{ fontSize: '0.78rem', color: '#374151', fontFamily: 'Inter,sans-serif' }}>
                              You are the <strong>admin</strong> — you can admit, mute, or remove participants. Meeting is <strong>recorded automatically</strong> and chat is saved.
                            </Box>
                          </Box>

                          {!videoLink ? (
                            <Box
                              onClick={async () => {
                                if (videoGenerating) return;
                                setVideoGenerating(true);
                                try {
                                  const res = await import('../services/api').then(m => m.default.post<{
                                    roomId: string; token: string; url: string;
                                  }>('/meetings/create', { title: title || 'Community Meeting' }));
                                  setVideoRoomId(res.data.roomId);
                                  setVideoToken(res.data.token);
                                  setVideoLink(res.data.url.split('?')[0]);
                                } catch (err) {
                                  console.error('[CreatePost] Failed to create meeting room:', err);
                                  setError('Failed to create meeting room. Please check your connection and try again.');
                                } finally {
                                  setVideoGenerating(false);
                                }
                              }}
                              sx={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.625rem 1.25rem',
                                background: videoGenerating ? '#E5E7EB' : GRAD,
                                color: videoGenerating ? '#9CA3AF' : '#FFF',
                                borderRadius: '0.5rem', cursor: videoGenerating ? 'default' : 'pointer',
                                fontSize: '0.875rem', fontWeight: 600, fontFamily: 'Inter,sans-serif',
                                boxShadow: videoGenerating ? 'none' : '0 2px 8px rgba(79,70,229,0.3)',
                                transition: 'opacity 0.15s', '&:hover': { opacity: videoGenerating ? 1 : 0.88 },
                              }}
                            >
                              {videoGenerating
                                ? <><i className="fas fa-spinner fa-spin" /> Creating secure room…</>
                                : <><i className="fas fa-lock" /> Create private meeting room</>
                              }
                            </Box>
                          ) : (
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.5rem', padding: '0.625rem 0.875rem', mb: '0.625rem' }}>
                                <i className="fas fa-video" style={{ color: '#10B981', fontSize: '0.8rem', flexShrink: 0 }} />
                                <Box sx={{ fontSize: '0.8rem', color: '#1F2937', fontFamily: 'Inter,sans-serif', flex: 1, wordBreak: 'break-all' }}>
                                  {videoLink}
                                </Box>
                              </Box>
                              <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <Box
                                  onClick={() => { navigator.clipboard.writeText(videoLink); setVideoCopied(true); setTimeout(() => setVideoCopied(false), 2000); }}
                                  sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', background: videoCopied ? 'rgba(16,185,129,0.1)' : 'rgba(79,70,229,0.08)', border: `1px solid ${videoCopied ? '#10B981' : '#4F46E5'}`, borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: videoCopied ? '#10B981' : '#4F46E5', fontFamily: 'Inter,sans-serif', transition: 'all 0.15s' }}>
                                  <i className={`fas ${videoCopied ? 'fa-check' : 'fa-copy'}`} />
                                  {videoCopied ? 'Copied!' : 'Copy link'}
                                </Box>
                                <Box
                                  onClick={() => { if (!videoRoomId) return; const dest = videoToken ? `/meeting/${videoRoomId}?token=${encodeURIComponent(videoToken)}` : videoLink; videoToken ? navigate(dest) : window.open(dest, '_blank'); }}
                                  sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', background: 'rgba(16,185,129,0.08)', border: '1px solid #10B981', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#10B981', fontFamily: 'Inter,sans-serif', transition: 'all 0.15s' }}>
                                  <i className="fas fa-video" />
                                  Test room
                                </Box>
                                <Box
                                  onClick={() => { setVideoLink(''); setVideoToken(''); setVideoCopied(false); setVideoRoomId(''); }}
                                  sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem', color: '#EF4444', fontFamily: 'Inter,sans-serif', transition: 'all 0.15s' }}>
                                  <i className="fas fa-redo" />
                                  Regenerate
                                </Box>
                              </Box>
                            </Box>
                          )}

                          <Box sx={{ mt: '0.875rem', display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                            <i className="fas fa-info-circle" style={{ color: '#6B7280', fontSize: '0.7rem', marginTop: '2px', flexShrink: 0 }} />
                            <Box sx={{ fontSize: '0.72rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                              This link will be shared with matched participants only after both parties confirm.
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    )}
                  </Box>
                  )}

                </CollapsibleSection>
              )}

              {/* ── Value & Schedule (skill / tool; tool requires an exchange type first) ── */}
              {(postType === 'skill' || (postType === 'tool' && toolExchangeType !== null)) && (
                <>
                  {/* Schedule Builder */}
                  <CollapsibleSection icon="fa-calendar-alt" title="Exchange Schedule" open={showSchedule} onToggle={() => setShowSchedule(v => !v)}>
                  <SkillContainer>

                    {/* ── TOOL: Permanent Exchange → single date only ── */}
                    {postType === 'tool' && toolExchangeType === 'permanent' && (
                      <Box sx={{ maxWidth: 260 }}>
                        <FormLabel>Exchange Date</FormLabel>
                        <InputBox value={startDate} onChange={setStartDate} type="date" />
                      </Box>
                    )}

                    {/* ── TOOL: Borrow → date range ── */}
                    {postType === 'tool' && toolExchangeType === 'borrow' && (
                      <>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '1rem', mb: '1rem' }}>
                          <Box>
                            <FormLabel>Borrow From</FormLabel>
                            <InputBox value={startDate} onChange={setStartDate} type="date" />
                          </Box>
                          <Box>
                            <FormLabel>Return By</FormLabel>
                            <InputBox value={borrowEndDate} onChange={setBorrowEndDate} type="date" />
                          </Box>
                        </Box>
                        {/* Duration preview */}
                        {startDate && borrowEndDate && (() => {
                          const ms = new Date(borrowEndDate + 'T00:00:00').getTime() - new Date(startDate + 'T00:00:00').getTime();
                          const days = Math.round(ms / 86400000);
                          return days > 0 ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', p: '0.625rem 0.875rem', background: 'rgba(79,70,229,0.05)', borderRadius: '0.5rem', border: '1px solid rgba(79,70,229,0.15)' }}>
                              <i className="fas fa-clock" style={{ color: '#4F46E5', fontSize: '0.8rem' }} />
                              <Box sx={{ fontSize: '0.83rem', color: '#374151', fontFamily: 'Inter,sans-serif' }}>
                                Borrow period: <strong>{days} day{days !== 1 ? 's' : ''}</strong>
                                {' · '}
                                {new Date(startDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                {' → '}
                                {new Date(borrowEndDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </Box>
                            </Box>
                          ) : null;
                        })()}
                      </>
                    )}

                    {/* ── SKILL: full recurring schedule ── */}
                    {postType === 'skill' && (
                      <>
                        {/* Date + time row */}
                        {recurring !== 'custom' && (
                          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: '1rem', mb: '1.5rem' }}>
                            <Box>
                              <FormLabel>Start Date</FormLabel>
                              <InputBox value={startDate} onChange={setStartDate} type="date" />
                            </Box>
                            <Box>
                              <FormLabel>From</FormLabel>
                              <InputBox value={timeStart} onChange={setTimeStart} type="time" />
                            </Box>
                            <Box>
                              <FormLabel>To</FormLabel>
                              <InputBox value={timeEnd} onChange={setTimeEnd} type="time" />
                            </Box>
                          </Box>
                        )}

                        {/* Recurring options */}
                        <FormLabel>Recurring Schedule</FormLabel>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '0.625rem', mb: '1.5rem' }}>
                          {[
                            { key: 'once',     label: 'One-time session',         icon: 'fa-calendar-day' },
                            { key: 'weekly',   label: 'Weekly (every week)',       icon: 'fa-redo' },
                            { key: 'biweekly', label: 'Bi-weekly (every 2 weeks)', icon: 'fa-history' },
                            { key: 'custom',   label: 'Custom schedule',           icon: 'fa-sliders-h' },
                          ].map(opt => (
                            <Box key={opt.key} onClick={() => setRecurring(opt.key)}
                              sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid', borderColor: recurring === opt.key ? '#4F46E5' : '#E5E7EB', background: recurring === opt.key ? 'rgba(79,70,229,0.05)' : '#FFF', transition: 'all 0.15s' }}>
                              <i className={`fas ${opt.icon}`} style={{ color: recurring === opt.key ? '#4F46E5' : '#9CA3AF', fontSize: '0.875rem', width: 16 }} />
                              <Box sx={{ fontSize: '0.875rem', color: '#1F2937', fontFamily: 'Inter,sans-serif', fontWeight: recurring === opt.key ? 600 : 400 }}>
                                {opt.label}
                              </Box>
                            </Box>
                          ))}
                        </Box>

                        {/* Number of sessions — weekly / biweekly */}
                        {(recurring === 'weekly' || recurring === 'biweekly') && (
                          <Box sx={{ mb: '1.5rem' }}>
                            <FormLabel>Number of Sessions</FormLabel>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <button type="button" onClick={() => setSessions(s => Math.max(1, s - 1))}
                                style={{ width: 36, height: 36, borderRadius: '0.5rem', border: '1px solid #E5E7EB', background: '#FFF', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', lineHeight: 1 }}>−</button>
                              <Box sx={{ fontWeight: 700, fontSize: '1.25rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif', minWidth: 32, textAlign: 'center' }}>
                                {sessions}
                              </Box>
                              <button type="button" onClick={() => setSessions(s => Math.min(12, s + 1))}
                                style={{ width: 36, height: 36, borderRadius: '0.5rem', border: '1px solid #E5E7EB', background: '#FFF', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', lineHeight: 1 }}>+</button>
                              <Box sx={{ fontSize: '0.8rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                                session{sessions !== 1 ? 's' : ''} · {recurring === 'weekly' ? `${sessions} week${sessions !== 1 ? 's' : ''}` : `${sessions * 2} weeks`} total
                              </Box>
                            </Box>
                          </Box>
                        )}

                        {/* Custom sessions */}
                        {recurring === 'custom' && (
                          <Box sx={{ mb: '1.5rem' }}>
                            <FormLabel>Custom Sessions</FormLabel>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {customSessions.map((cs, idx) => (
                                <Box key={cs.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr auto' }, gap: '0.625rem', alignItems: 'end', padding: '0.875rem 1rem', background: '#FFF', borderRadius: '0.5rem', border: '1px solid #E5E7EB' }}>
                                  <Box>
                                    <FormLabel>Session {idx + 1} Date</FormLabel>
                                    <InputBox value={cs.date} onChange={v => updateCustomSession(cs.id, 'date', v)} type="date" />
                                  </Box>
                                  <Box>
                                    <FormLabel>From</FormLabel>
                                    <InputBox value={cs.timeStart} onChange={v => updateCustomSession(cs.id, 'timeStart', v)} type="time" />
                                  </Box>
                                  <Box>
                                    <FormLabel>To</FormLabel>
                                    <InputBox value={cs.timeEnd} onChange={v => updateCustomSession(cs.id, 'timeEnd', v)} type="time" />
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'flex-end', pb: '2px' }}>
                                    <button type="button" onClick={() => removeCustomSession(cs.id)} disabled={customSessions.length === 1}
                                      style={{ width: 36, height: 44, border: 'none', background: customSessions.length === 1 ? '#F3F4F6' : '#FEE2E2', borderRadius: '0.5rem', cursor: customSessions.length === 1 ? 'not-allowed' : 'pointer', color: customSessions.length === 1 ? '#D1D5DB' : '#EF4444', fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <i className="fas fa-times" />
                                    </button>
                                  </Box>
                                </Box>
                              ))}
                            </Box>
                            <button type="button" onClick={addCustomSession}
                              style={{ marginTop: '0.75rem', padding: '0.625rem 1.25rem', border: '1px dashed #4F46E5', borderRadius: '0.5rem', background: 'rgba(79,70,229,0.04)', color: '#4F46E5', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Inter,sans-serif' }}>
                              <i className="fas fa-plus" /> Add Session
                            </button>
                          </Box>
                        )}

                        {/* Sessions preview */}
                        {(recurring !== 'custom' ? startDate : customSessions.some(s => s.date)) && (
                          <Box>
                            <FormLabel>Scheduled Sessions</FormLabel>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                              {recurring === 'custom'
                                ? customSessions.map((cs, i) => {
                                    const h = parseHours(cs.timeStart, cs.timeEnd);
                                    const dateStr = cs.date
                                      ? new Date(cs.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })
                                      : 'Date TBD';
                                    return (
                                      <Box key={cs.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: '#FFF', borderRadius: '0.5rem', border: '1px solid #E5E7EB' }}>
                                        <Box>
                                          <Box sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>Session {i + 1}: {dateStr}</Box>
                                          <Box sx={{ fontSize: '0.78rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                                            {fmt12(cs.timeStart)} – {fmt12(cs.timeEnd)} · {locType === 'public' ? publicPlace || 'Location TBD' : privatePlace || 'Private location'}
                                          </Box>
                                        </Box>
                                        <Box sx={{ padding: '0.25rem 0.625rem', background: 'rgba(79,70,229,0.1)', borderRadius: '0.375rem', fontSize: '0.75rem', color: '#4F46E5', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                          {h.toFixed(1).replace(/\.0$/, '')}h
                                        </Box>
                                      </Box>
                                    );
                                  })
                                : Array.from({ length: recurring === 'once' ? 1 : sessions }).map((_, i) => {
                                    const d = new Date(startDate + 'T00:00:00');
                                    if (recurring === 'weekly')   d.setDate(d.getDate() + i * 7);
                                    if (recurring === 'biweekly') d.setDate(d.getDate() + i * 14);
                                    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });
                                    return (
                                      <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: '#FFF', borderRadius: '0.5rem', border: '1px solid #E5E7EB' }}>
                                        <Box>
                                          <Box sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>Session {i + 1}: {dateStr}</Box>
                                          <Box sx={{ fontSize: '0.78rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                                            {fmt12(timeStart)} – {fmt12(timeEnd)} · {locType === 'public' ? publicPlace || 'Location TBD' : privatePlace || 'Private location'}
                                          </Box>
                                        </Box>
                                        <Box sx={{ padding: '0.25rem 0.625rem', background: 'rgba(79,70,229,0.1)', borderRadius: '0.375rem', fontSize: '0.75rem', color: '#4F46E5', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                          {sessionHours.toFixed(1).replace(/\.0$/, '')}h
                                        </Box>
                                      </Box>
                                    );
                                  })
                              }
                            </Box>
                          </Box>
                        )}
                      </>
                    )}
                  </SkillContainer>
                  </CollapsibleSection>

                  {/* CEU Value — skill only, not relevant for tool listings */}
                  {postType !== 'tool' && <CollapsibleSection icon="fa-coins" title="CEU Value" open={showCEU} onToggle={() => setShowCEU(v => !v)}>
                  <SkillContainer>

                    {/* Formula inputs — tool */}
                    {postType === 'tool' && (
                      <Box sx={{ mb: '1.25rem' }}>
                        <FormLabel>Market Value</FormLabel>

                        {/* Currency searchable combobox + value input row */}
                        <Box sx={{ display: 'flex', gap: '0.5rem', mb: '0.5rem' }}>
                          {/* Currency combobox — shares same state as Step 2 combobox */}
                          <Box ref={currencyDropRef} sx={{ position: 'relative', flexShrink: 0 }}>
                            <Box
                              onClick={() => { setCurrencyDropOpen(v => !v); setCurrencySearch(''); }}
                              sx={{
                                display: 'flex', alignItems: 'center', gap: '0.375rem',
                                padding: '0.875rem 0.625rem 0.875rem 0.75rem',
                                border: '1px solid #E5E7EB', borderRadius: '0.5rem',
                                background: '#FFF', cursor: 'pointer', userSelect: 'none',
                                fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', fontFamily: 'Inter,sans-serif',
                                whiteSpace: 'nowrap', minWidth: 80,
                                '&:hover': { borderColor: '#4F46E5' },
                              }}
                            >
                              {userCurrency}
                              <i className="fas fa-chevron-down" style={{ fontSize: '0.6rem', color: '#9CA3AF', marginLeft: 2 }} />
                            </Box>
                            {currencyDropOpen && (() => {
                              const q = currencySearch.trim().toLowerCase();
                              const filtered = ALL_CURRENCIES.filter(c =>
                                !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.sym.toLowerCase().includes(q)
                              );
                              return (
                                <Box sx={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 60, width: 280, background: '#FFF', border: '1.5px solid #E5E7EB', borderRadius: '0.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.10)', overflow: 'hidden' }}>
                                  <Box sx={{ p: '0.5rem', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', px: '0.625rem', py: '0.375rem', border: '1.5px solid #E5E7EB', borderRadius: '0.375rem', background: '#FFF', '&:focus-within': { borderColor: '#4F46E5' } }}>
                                      <i className="fas fa-search" style={{ color: '#9CA3AF', fontSize: '0.7rem', flexShrink: 0 }} />
                                      <Box component="input" autoFocus type="text" value={currencySearch} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrencySearch(e.target.value)} placeholder="Search currency…" sx={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.8125rem', fontFamily: 'Inter,sans-serif', color: '#1F2937', background: 'transparent' }} />
                                    </Box>
                                  </Box>
                                  <Box sx={{ maxHeight: 220, overflowY: 'auto' }}>
                                    {filtered.length === 0
                                      ? <Box sx={{ px: '0.875rem', py: '0.625rem', fontSize: '0.8rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif' }}>No currencies found</Box>
                                      : filtered.map(c => (
                                        <Box key={c.code} onMouseDown={() => { setUserCurrency(c.code); setCurrencyDropOpen(false); setCurrencySearch(''); }}
                                          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: '0.875rem', py: '0.5rem', cursor: 'pointer', background: c.code === userCurrency ? 'rgba(79,70,229,0.06)' : 'transparent', '&:hover': { background: 'rgba(79,70,229,0.06)' } }}>
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Box sx={{ fontWeight: 700, fontSize: '0.8125rem', color: '#1F2937', fontFamily: 'Inter,sans-serif', minWidth: 36 }}>{c.code}</Box>
                                            <Box sx={{ fontSize: '0.78rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>{c.name}</Box>
                                          </Box>
                                          <Box sx={{ fontSize: '0.8125rem', fontWeight: 600, color: c.code === userCurrency ? '#4F46E5' : '#9CA3AF', fontFamily: 'Inter,sans-serif', ml: '0.5rem' }}>{c.sym}</Box>
                                        </Box>
                                      ))
                                    }
                                  </Box>
                                </Box>
                              );
                            })()}
                          </Box>
                          {/* Value input */}
                          <Box sx={{ flex: 1, display: 'flex', border: '1px solid #E5E7EB', borderRadius: '0.5rem', overflow: 'hidden', background: '#FFF', '&:focus-within': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' } }}>
                            <Box sx={{ px: '0.75rem', display: 'flex', alignItems: 'center', borderRight: '1px solid #E5E7EB', background: '#F3F4F6', fontSize: '0.875rem', fontWeight: 600, color: '#6B7280', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {sym}
                            </Box>
                            <Box component="input" type="number" value={toolMarketValue} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToolMarketValue(e.target.value)} placeholder="0.00"
                              sx={{ flex: 1, px: '0.875rem', py: '0.875rem', border: 'none', fontSize: '0.875rem', color: '#1F2937', background: 'transparent', outline: 'none', minWidth: 0, fontFamily: 'Inter,sans-serif', '&::placeholder': { color: '#9CA3AF' } }} />
                          </Box>
                        </Box>

                        {/* USD conversion preview */}
                        {userCurrency !== 'USD' && mvRaw > 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', mb: '0.5rem', fontSize: '0.78rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                            <i className="fas fa-exchange-alt" style={{ color: '#10B981', fontSize: '0.7rem' }} />
                            {CURRENCY_SYMBOLS[userCurrency]}{mvRaw.toFixed(2)} {userCurrency}
                            {' → '}
                            <strong style={{ color: '#1F2937' }}>${mvUsd.toFixed(2)} USD</strong>
                            {exchangeRates[userCurrency]
                              ? <Box component="span" sx={{ color: '#9CA3AF' }}>· rate: 1 USD = {exchangeRates[userCurrency].toFixed(4)} {userCurrency}</Box>
                              : null
                            }
                          </Box>
                        )}

                        <FormHint icon="fa-info-circle">Estimated replacement cost · formula uses USD</FormHint>

                        {/* Risk factor pill */}
                        {toolExchangeType === 'borrow' && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mt: '0.75rem', p: '0.5rem 0.75rem', background: 'rgba(79,70,229,0.04)', border: '1px solid rgba(79,70,229,0.12)', borderRadius: '0.5rem' }}>
                            <i className="fas fa-shield-alt" style={{ color: '#4F46E5', fontSize: '0.75rem' }} />
                            <Box sx={{ fontSize: '0.78rem', color: '#374151', fontFamily: 'Inter,sans-serif' }}>
                              Risk factor: <strong>+{rf} CEU</strong>
                              <Box component="span" sx={{ color: '#9CA3AF', ml: '0.375rem' }}>(from condition: {toolCondition})</Box>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    )}

                    {/* Skill: session summary */}
                    {postType === 'skill' && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '1.25rem', padding: '0.75rem 1rem', background: 'rgba(79,70,229,0.05)', border: '1px solid rgba(79,70,229,0.15)', borderRadius: '0.5rem' }}>
                        <i className="fas fa-clock" style={{ color: '#4F46E5', fontSize: '0.875rem' }} />
                        <Box sx={{ fontSize: '0.875rem', color: '#4F46E5', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>
                          {sessionHours.toFixed(1).replace(/\.0$/, '')}h · {effectiveSessions} session{effectiveSessions !== 1 ? 's' : ''} · {proficiency}
                        </Box>
                      </Box>
                    )}

                    {/* Formula result suggestion */}
                    {suggestedCeu > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', p: '0.75rem 1rem', background: 'rgba(79,70,229,0.05)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: '0.5rem', mb: '1.25rem', flexWrap: 'wrap' }}>
                        <Box>
                          <Box sx={{ fontSize: '0.78rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', mb: '0.125rem' }}>
                            <i className="fas fa-calculator" style={{ marginRight: '0.375rem', color: '#4F46E5' }} />
                            Formula suggests
                          </Box>
                          <Box sx={{ fontWeight: 700, fontSize: '1.125rem', color: '#4F46E5', fontFamily: 'Poppins,sans-serif' }}>
                            {suggestedCeu} CEU
                          </Box>
                          <Box sx={{ fontSize: '0.72rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', mt: '0.125rem' }}>
                            {postType === 'tool'
                              ? `${mvDisplay} × 0.001 × ${bd} day${bd !== 1 ? 's' : ''} + ${rf} risk`
                              : `${sessionHours.toFixed(1).replace(/\.0$/, '')}h × SkillMult × ${PROF_MULTS[proficiency] ?? 1.0} × ${effectiveSessions} session${effectiveSessions !== 1 ? 's' : ''}`
                            }
                          </Box>
                        </Box>
                        <Box component="button" type="button"
                          onClick={() => setExtraCeu(suggestedCeu)}
                          sx={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1.5px solid #4F46E5', background: '#EEF2FF', color: '#4F46E5', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', '&:hover': { background: '#4F46E5', color: '#FFF' } }}>
                          Use this
                        </Box>
                      </Box>
                    )}

                    {/* User input — how much they want */}
                    <FormLabel>How much CEU do you want?</FormLabel>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', mt: '0.5rem', mb: '1rem' }}>
                      <Box component="button" type="button"
                        onClick={() => setExtraCeu(Math.max(0, extraCeu - 1))}
                        disabled={extraCeu === 0}
                        sx={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid #E5E7EB', background: extraCeu === 0 ? '#F9FAFB' : '#FFF', color: extraCeu === 0 ? '#D1D5DB' : '#4F46E5', cursor: extraCeu === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 700, flexShrink: 0, transition: 'all 0.15s', '&:hover': extraCeu > 0 ? { background: '#EEF2FF', borderColor: '#4F46E5' } : {} }}>
                        −
                      </Box>
                      <Box sx={{ flex: 1, position: 'relative' }}>
                        <Box component="input" type="number" min={0}
                          value={extraCeu === 0 ? '' : extraCeu}
                          placeholder="0"
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExtraCeu(Math.max(0, parseInt(e.target.value) || 0))}
                          sx={{ width: '100%', border: '1.5px solid #E5E7EB', borderRadius: '0.5rem', textAlign: 'center', py: '0.625rem', px: '0.5rem', fontSize: '1.5rem', fontWeight: 700, color: '#1F2937', fontFamily: 'Poppins,sans-serif', outline: 'none', boxSizing: 'border-box', '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' }, '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { '-webkit-appearance': 'none' } }}
                        />
                        <Box component="span" sx={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', pointerEvents: 'none' }}>
                          CEU
                        </Box>
                      </Box>
                      <Box component="button" type="button"
                        onClick={() => setExtraCeu(extraCeu + 1)}
                        sx={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid #4F46E5', background: '#EEF2FF', color: '#4F46E5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 700, flexShrink: 0, transition: 'all 0.15s', '&:hover': { background: '#4F46E5', color: '#FFF' } }}>
                        +
                      </Box>
                    </Box>

                    {/* Quick-pick chips */}
                    <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', mb: '1.25rem' }}>
                      {[5, 10, 15, 20, 25, 50].map(v => (
                        <Box key={v} component="button" type="button"
                          onClick={() => setExtraCeu(v)}
                          sx={{ background: extraCeu === v ? '#4F46E5' : '#F3F4F6', color: extraCeu === v ? '#FFF' : '#6B7280', border: 'none', borderRadius: '2rem', px: '0.75rem', py: '0.3rem', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', cursor: 'pointer', transition: 'all 0.15s', '&:hover': { background: extraCeu === v ? '#4338CA' : '#E5E7EB' } }}>
                          {v} CEU
                        </Box>
                      ))}
                    </Box>

                    {/* Total banner */}
                    <Box sx={{ background: GRAD, color: '#FFF', borderRadius: '0.75rem', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <i className="fas fa-coins" style={{ fontSize: '1.25rem' }} />
                        <Box sx={{ fontFamily: 'Poppins,sans-serif' }}>
                          <Box sx={{ fontSize: '0.78rem', opacity: 0.85 }}>You will receive</Box>
                          <Box sx={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1 }}>{totalCeu} CEU</Box>
                        </Box>
                      </Box>
                      <Box sx={{ fontSize: '0.78rem', opacity: 0.85, textAlign: 'right', fontFamily: 'Inter,sans-serif' }}>
                        Your balance<br /><strong>{(user?.ceuBalance ?? 0).toLocaleString()} CEU</strong>
                      </Box>
                    </Box>
                  </SkillContainer>
                  </CollapsibleSection>}
                </>
              )}

              {/* Event details */}
              {postType === 'event' && (
                <>
                  <SectionTitle icon="fa-calendar-day">Event Details</SectionTitle>
                  <SkillContainer>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '1.25rem', mb: '1.25rem' }}>
                      <Box>
                        <FormLabel>Start Date & Time <span style={{ color: '#EF4444' }}>*</span></FormLabel>
                        <InputBox value={eventDate} onChange={setEventDate} type="datetime-local" min={new Date().toISOString().slice(0, 16)} />
                      </Box>
                      <Box>
                        <FormLabel>End Date & Time</FormLabel>
                        <InputBox value={eventEndDate} onChange={setEventEndDate} type="datetime-local" min={new Date().toISOString().slice(0, 16)} />
                      </Box>
                      <Box>
                        <FormLabel>Capacity</FormLabel>
                        <InputBox value={eventCapacity} onChange={setEventCapacity} type="number" placeholder="Max attendees (leave blank for unlimited)" />
                      </Box>
                    </Box>
                  </SkillContainer>

                  {/* Location — events only support public places or online */}
                  <SectionTitle icon="fa-map-marker-alt">Location <span style={{ color: '#EF4444', fontSize: '1rem' }}>*</span></SectionTitle>
                  {/* Public place picker — events only support public locations */}
                  {!(onlineVideo || onlineOnly) && (
                    <SkillContainer>
                      <FormLabel>Public Place Selection</FormLabel>
                      <PublicPlacePicker
                        value={publicPlace}
                        onChange={setPublicPlace}
                        userCoordinates={
                          user?.location?.coordinates &&
                          (user.location.coordinates as number[])[0] !== 0 &&
                          (user.location.coordinates as number[])[1] !== 0
                            ? (user.location.coordinates as [number, number])
                            : undefined
                        }
                      />
                      <FormHint icon="fa-shield-alt">
                        Search or click a pin on the map — public locations are recommended for community events
                      </FormHint>
                    </SkillContainer>
                  )}

                  {/* Online toggle */}
                  <Box sx={{ mt: '1.5rem' }}>
                    <Box
                      onClick={() => {
                        const next = !(onlineVideo || onlineOnly);
                        setOnlineVideo(next);
                        setOnlineOnly(next);
                        if (!next) { setVideoLink(''); setVideoToken(''); setVideoCopied(false); }
                      }}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: '1rem',
                        padding: '1rem 1.25rem', borderRadius: '0.75rem', cursor: 'pointer',
                        border: (onlineVideo || onlineOnly) ? '1.5px solid rgba(79,70,229,0.35)' : '1.5px solid #E5E7EB',
                        background: (onlineVideo || onlineOnly)
                          ? 'linear-gradient(135deg, rgba(79,70,229,0.05) 0%, rgba(16,185,129,0.05) 100%)'
                          : '#FAFAFA',
                        transition: 'all 0.2s', userSelect: 'none',
                        '&:hover': { borderColor: '#4F46E5', background: 'linear-gradient(135deg, rgba(79,70,229,0.05) 0%, rgba(16,185,129,0.05) 100%)' },
                      }}
                    >
                      <Box sx={{
                        width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                        background: (onlineVideo || onlineOnly) ? GRAD : '#F3F4F6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s',
                        boxShadow: (onlineVideo || onlineOnly) ? '0 3px 10px rgba(79,70,229,0.3)' : 'none',
                      }}>
                        <i className="fas fa-video" style={{ fontSize: '1rem', color: (onlineVideo || onlineOnly) ? '#FFF' : '#9CA3AF' }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ fontSize: '0.9rem', fontWeight: 600, color: (onlineVideo || onlineOnly) ? '#4F46E5' : '#374151', fontFamily: 'Inter,sans-serif', transition: 'color 0.2s' }}>
                          This event can be attended online
                        </Box>
                        <Box sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', mt: '2px' }}>
                          {(onlineVideo || onlineOnly) ? 'Video call enabled — create your meeting link below' : 'Enable to offer a video call option to attendees'}
                        </Box>
                      </Box>
                      <Box sx={{
                        width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                        background: (onlineVideo || onlineOnly) ? GRAD : '#D1D5DB',
                        position: 'relative', transition: 'background 0.25s',
                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.12)',
                      }}>
                        <Box sx={{
                          position: 'absolute', top: 3,
                          left: (onlineVideo || onlineOnly) ? 23 : 3,
                          width: 18, height: 18, borderRadius: '50%', background: '#FFF',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
                          transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1)',
                        }} />
                      </Box>
                    </Box>

                    {/* Video link creator */}
                    {(onlineVideo || onlineOnly) && (
                      <Box sx={{ mt: '1.25rem', border: '1px solid #E5E7EB', borderRadius: '0.75rem', overflow: 'hidden' }}>
                        <Box sx={{ background: GRAD, padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                          <i className="fas fa-video" style={{ color: '#FFF', fontSize: '0.9rem' }} />
                          <Box sx={{ fontWeight: 600, color: '#FFF', fontSize: '0.9rem', fontFamily: 'Poppins,sans-serif' }}>
                            Video Meeting Link
                          </Box>
                        </Box>
                        <Box sx={{ padding: '1.25rem', background: '#FAFAFA' }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', mb: '0.75rem', p: '0.625rem 0.875rem', background: 'rgba(79,70,229,0.05)', borderRadius: '0.5rem', border: '1px solid rgba(79,70,229,0.15)' }}>
                            <i className="fas fa-shield-alt" style={{ color: '#4F46E5', fontSize: '0.75rem', marginTop: '2px', flexShrink: 0 }} />
                            <Box sx={{ fontSize: '0.78rem', color: '#374151', fontFamily: 'Inter,sans-serif' }}>
                              You are the <strong>admin</strong> — you can admit, mute, or remove participants. Meeting is <strong>recorded automatically</strong> and chat is saved.
                            </Box>
                          </Box>

                          {!videoLink ? (
                            <Box
                              onClick={async () => {
                                if (videoGenerating) return;
                                setVideoGenerating(true);
                                try {
                                  const res = await import('../services/api').then(m => m.default.post<{
                                    roomId: string; token: string; url: string;
                                  }>('/meetings/create', { title: title || 'Community Event' }));
                                  setVideoRoomId(res.data.roomId);
                                  setVideoToken(res.data.token);
                                  setVideoLink(res.data.url.split('?')[0]);
                                } catch (err) {
                                  console.error('[CreatePost] Failed to create meeting room:', err);
                                  setError('Failed to create meeting room. Please check your connection and try again.');
                                } finally {
                                  setVideoGenerating(false);
                                }
                              }}
                              sx={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.625rem 1.25rem',
                                background: videoGenerating ? '#E5E7EB' : GRAD,
                                color: videoGenerating ? '#9CA3AF' : '#FFF',
                                borderRadius: '0.5rem', cursor: videoGenerating ? 'default' : 'pointer',
                                fontSize: '0.875rem', fontWeight: 600, fontFamily: 'Inter,sans-serif',
                                boxShadow: videoGenerating ? 'none' : '0 2px 8px rgba(79,70,229,0.3)',
                                transition: 'opacity 0.15s', '&:hover': { opacity: videoGenerating ? 1 : 0.88 },
                              }}
                            >
                              {videoGenerating
                                ? <><i className="fas fa-spinner fa-spin" /> Creating secure room…</>
                                : <><i className="fas fa-lock" /> Create private meeting room</>
                              }
                            </Box>
                          ) : (
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.5rem', padding: '0.625rem 0.875rem', mb: '0.625rem' }}>
                                <i className="fas fa-video" style={{ color: '#10B981', fontSize: '0.8rem', flexShrink: 0 }} />
                                <Box sx={{ fontSize: '0.8rem', color: '#1F2937', fontFamily: 'Inter,sans-serif', flex: 1, wordBreak: 'break-all' }}>
                                  {videoLink}
                                </Box>
                              </Box>
                              <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <Box
                                  onClick={() => { navigator.clipboard.writeText(videoLink); setVideoCopied(true); setTimeout(() => setVideoCopied(false), 2000); }}
                                  sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', background: videoCopied ? 'rgba(16,185,129,0.1)' : 'rgba(79,70,229,0.08)', border: `1px solid ${videoCopied ? '#10B981' : '#4F46E5'}`, borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: videoCopied ? '#10B981' : '#4F46E5', fontFamily: 'Inter,sans-serif', transition: 'all 0.15s' }}>
                                  <i className={`fas ${videoCopied ? 'fa-check' : 'fa-copy'}`} />
                                  {videoCopied ? 'Copied!' : 'Copy link'}
                                </Box>
                                <Box
                                  onClick={() => { if (!videoRoomId) return; const dest = videoToken ? `/meeting/${videoRoomId}?token=${encodeURIComponent(videoToken)}` : videoLink; videoToken ? navigate(dest) : window.open(dest, '_blank'); }}
                                  sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', background: 'rgba(16,185,129,0.08)', border: '1px solid #10B981', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#10B981', fontFamily: 'Inter,sans-serif', transition: 'all 0.15s' }}>
                                  <i className="fas fa-video" />
                                  Test room
                                </Box>
                                <Box
                                  onClick={() => { setVideoLink(''); setVideoToken(''); setVideoCopied(false); setVideoRoomId(''); }}
                                  sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem', color: '#EF4444', fontFamily: 'Inter,sans-serif', transition: 'all 0.15s' }}>
                                  <i className="fas fa-redo" />
                                  Regenerate
                                </Box>
                              </Box>
                            </Box>
                          )}

                          <Box sx={{ mt: '0.875rem', display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                            <i className="fas fa-info-circle" style={{ color: '#6B7280', fontSize: '0.7rem', marginTop: '2px', flexShrink: 0 }} />
                            <Box sx={{ fontSize: '0.72rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                              This link will be shared with attendees only after you publish the event.
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    )}
                  </Box>
                </>
              )}

              {/* ── Question: CEU Reward ── */}
              {postType === 'question' && (
                <>
                  <SectionTitle icon="fa-coins">CEU Reward <span style={{ color: '#EF4444', fontSize: '1rem' }}>*</span></SectionTitle>
                  <SkillContainer>
                    {/* Category */}
                    <Box sx={{ mb: '1.5rem' }}>
                      <FormLabel>Question Category</FormLabel>
                      <SelectBox value={questionCategory} onChange={setQuestionCategory} fullWidth>
                        {['General', 'Skills & Learning', 'Tools & Equipment', 'Events & Community', 'Safety', 'Recommendations'].map(c =>
                          <option key={c} value={c}>{c}</option>
                        )}
                      </SelectBox>
                      <FormHint icon="fa-tag">Categorising your question helps the right people find and answer it</FormHint>
                    </Box>

                    {/* How CEU is calculated — always visible info panel */}
                    <Box sx={{ mb: '1.25rem', borderRadius: '0.75rem', border: '1px solid rgba(79,70,229,0.15)', overflow: 'hidden' }}>
                      <Box sx={{ background: 'linear-gradient(135deg,rgba(79,70,229,0.08),rgba(16,185,129,0.06))', px: '1rem', py: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className="fas fa-info-circle" style={{ color: '#4F46E5', fontSize: '0.8rem' }} />
                        <Box sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>How answer rewards work</Box>
                      </Box>
                      <Box sx={{ px: '1rem', py: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {[
                          { label: 'For every upvote the answer gets', value: '+1 CEU' },
                          { label: 'Base reward just for answering',   value: '+1 CEU' },
                          { label: 'Bonus if marked as accepted',      value: '+3 CEU' },
                          { label: 'Your bounty (set below)',          value: `+${Number(bounty) >= 1 ? bounty : '?'} CEU` },
                        ].map(row => (
                          <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ fontSize: '0.8125rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>{row.label}</Box>
                            <Box sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Poppins,sans-serif' }}>{row.value}</Box>
                          </Box>
                        ))}
                        <Box sx={{ mt: '0.375rem', pt: '0.5rem', borderTop: '1px dashed #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>Best answer could earn</Box>
                          <Box sx={{ fontSize: '0.9375rem', fontWeight: 800, color: '#10B981', fontFamily: 'Poppins,sans-serif' }}>
                            4 + upvotes + {Number(bounty) >= 1 ? bounty : '?'} CEU
                          </Box>
                        </Box>
                      </Box>
                    </Box>

                    {/* Bounty input */}
                    <Box>
                      <FormLabel>Your Bounty <span style={{ color: '#EF4444' }}>*</span> <Box component="span" sx={{ fontWeight: 400, color: '#9CA3AF', fontSize: '0.8rem' }}>(min 1 CEU)</Box></FormLabel>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Box sx={{ position: 'relative', flex: 1 }}>
                          <InputBox
                            value={bounty}
                            onChange={v => setBounty(String(Math.min(500, Math.max(1, Number(v) || 1))))}
                            type="number"
                            min="1"
                            placeholder="1"
                          />
                          <Box component="span" sx={{
                            position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                            fontSize: '0.8rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', pointerEvents: 'none',
                          }}>CEU</Box>
                        </Box>
                        {/* Inline balance indicator */}
                        <Box sx={{
                          px: '0.875rem', py: '0.625rem', borderRadius: '0.5rem', whiteSpace: 'nowrap',
                          background: Number(bounty) > (user?.ceuBalance ?? 0) ? 'rgba(239,68,68,0.07)' : 'rgba(16,185,129,0.07)',
                          border: `1px solid ${Number(bounty) > (user?.ceuBalance ?? 0) ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.2)'}`,
                        }}>
                          <Box sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>Your balance</Box>
                          <Box sx={{ fontSize: '0.875rem', fontWeight: 700, color: Number(bounty) > (user?.ceuBalance ?? 0) ? '#EF4444' : '#10B981', fontFamily: 'Poppins,sans-serif' }}>
                            {user?.ceuBalance ?? 0} CEU
                          </Box>
                        </Box>
                      </Box>
                      <FormHint icon="fa-lock">
                        {Number(bounty) > (user?.ceuBalance ?? 0)
                          ? `⚠ Exceeds your balance — reduce to ${user?.ceuBalance ?? 0} CEU or less`
                          : `${bounty} CEU will be deducted from your balance and awarded to the best answer`}
                      </FormHint>
                    </Box>
                  </SkillContainer>
                </>
              )}

              {/* Tags — all types */}
              <Box sx={{ mb: '1.5rem' }} ref={tagContainerRef}>
                <FormLabel>Tags</FormLabel>
                <Box sx={{ position: 'relative' }}>
                  <Box
                    component="input"
                    value={tagInput}
                    disabled={tags.length >= 8}
                    placeholder={tags.length >= 8 ? 'Max 8 tags reached' : 'Search or add a tag…'}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setTagInput(e.target.value); setTagHighlight(-1); setTagDropdownOpen(true);
                    }}
                    onFocus={() => setTagDropdownOpen(true)}
                    onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                      if (!tagContainerRef.current?.contains(e.relatedTarget as Node))
                        setTimeout(() => setTagDropdownOpen(false), 150);
                    }}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      const query = tagInput.trim().toLowerCase();
                      const filtered = SUGGESTED_TAGS.filter(s => !tags.includes(s) && s.includes(query));
                      const showCustom = query && !SUGGESTED_TAGS.includes(query) && !tags.includes(query);
                      const items = showCustom ? [query, ...filtered] : filtered;
                      if (e.key === 'ArrowDown') { e.preventDefault(); setTagHighlight(h => Math.min(h + 1, items.length - 1)); }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setTagHighlight(h => Math.max(h - 1, 0)); }
                      else if (e.key === 'Enter') {
                        e.preventDefault();
                        const pick = tagHighlight >= 0 ? items[tagHighlight] : query;
                        if (pick && !tags.includes(pick) && tags.length < 8) {
                          setTags(t => [...t, pick]); setTagInput(''); setTagDropdownOpen(false); setTagHighlight(-1);
                        }
                      } else if (e.key === 'Escape') { setTagDropdownOpen(false); }
                    }}
                    sx={{
                      width: '100%', padding: '0.875rem 1rem', border: '1px solid #E5E7EB',
                      borderRadius: tagDropdownOpen ? '0.5rem 0.5rem 0 0' : '0.5rem',
                      fontSize: '0.875rem', fontFamily: 'Inter,sans-serif',
                      outline: 'none', boxSizing: 'border-box', color: '#1F2937',
                      transition: 'border-color 0.15s',
                      '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' },
                      '&::placeholder': { color: '#9CA3AF' },
                      background: '#FFF',
                    }}
                  />
                  {tagDropdownOpen && tags.length < 8 && (() => {
                    const query = tagInput.trim().toLowerCase();
                    const filtered = SUGGESTED_TAGS.filter(s => !tags.includes(s) && (query === '' || s.includes(query)));
                    const showCustom = query && !SUGGESTED_TAGS.includes(query) && !tags.includes(query);
                    const items: Array<{ label: string; isCustom: boolean }> = [
                      ...(showCustom ? [{ label: query, isCustom: true }] : []),
                      ...filtered.map(s => ({ label: s, isCustom: false })),
                    ];
                    if (!items.length) return null;
                    return (
                      <Box sx={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                        background: '#FFF', border: '1px solid #4F46E5', borderTop: 'none',
                        borderRadius: '0 0 0.5rem 0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        maxHeight: 220, overflowY: 'auto',
                      }}>
                        {items.map((item, i) => (
                          <Box key={item.label}
                            onMouseDown={(e: React.MouseEvent) => {
                              e.preventDefault();
                              if (!tags.includes(item.label) && tags.length < 8) {
                                setTags(t => [...t, item.label]); setTagInput(''); setTagDropdownOpen(false); setTagHighlight(-1);
                              }
                            }}
                            onMouseEnter={() => setTagHighlight(i)}
                            sx={{
                              px: '1rem', py: '0.625rem', cursor: 'pointer', fontSize: '0.875rem',
                              fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.5rem',
                              background: tagHighlight === i ? '#EEF2FF' : 'transparent',
                              color: tagHighlight === i ? '#4F46E5' : '#1F2937',
                              transition: 'background 0.1s',
                              borderTop: i === 0 ? 'none' : '1px solid #F3F4F6',
                            }}>
                            {item.isCustom
                              ? <><i className="fas fa-plus" style={{ fontSize: '0.7rem', color: '#10B981' }} /><span>Add <strong>"{item.label}"</strong></span></>
                              : <><i className="fas fa-tag"  style={{ fontSize: '0.7rem', color: '#6B7280' }} /><span>#{item.label}</span></>
                            }
                          </Box>
                        ))}
                      </Box>
                    );
                  })()}
                </Box>
                {tags.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', mt: '0.75rem' }}>
                    {tags.map(tag => (
                      <Box key={tag} sx={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                        background: '#EEF2FF', color: '#4F46E5', borderRadius: '2rem',
                        padding: '0.25rem 0.625rem', fontSize: '0.75rem', fontWeight: 600,
                        border: '1px solid #C7D2FE',
                      }}>
                        #{tag}
                        <Box component="button" type="button" onClick={() => setTags(t => t.filter(x => x !== tag))}
                          sx={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4F46E5', padding: 0, opacity: 0.7, '&:hover': { opacity: 1 } }}>
                          <i className="fas fa-times" style={{ fontSize: '0.65rem' }} />
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
                <FormHint icon="fa-info-circle">Type to search tags or add your own. Up to 8 tags.</FormHint>
              </Box>

            </Box>
          )}

          {/* ══════════ STEP 4: REVIEW ══════════ */}
          {step === 3 && (
            <Box>
              <SectionTitle icon="fa-clipboard-check">Review & Confirm</SectionTitle>

              <SkillContainer>
                <Box sx={{ fontWeight: 600, color: '#4F46E5', mb: '1rem', fontFamily: 'Poppins,sans-serif', fontSize: '1rem' }}>
                  Post Summary
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '1.5rem', mb: '1.5rem' }}>
                  {[
                    { label: 'Post Type',  value: selectedType.label },
                    { label: postType === 'tool' ? 'Tool Name' : 'Title', value: title || '—' },
                    ...(postType === 'skill' ? [
                      { label: 'Proficiency',       value: proficiency },
                      { label: 'CEU Value',          value: `${totalCeu} CEU` },
                      { label: 'Session Length',     value: `${sessionHours.toFixed(1).replace(/\.0$/, '')}h (${fmt12(timeStart)} – ${fmt12(timeEnd)})` },
                      { label: 'Sessions',           value: `${effectiveSessions} session${effectiveSessions !== 1 ? 's' : ''} (${recurring})` },
                      { label: 'Start Date',         value: startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('en-GB', { dateStyle: 'medium' }) : 'Flexible' },
                      { label: 'Exchange Location',  value: (onlineVideo || onlineOnly) ? 'Online' : locType === 'public' ? publicPlace || 'Not specified' : '[Private Location]' },
                    ] : []),
                    ...(postType === 'tool' ? [
                      { label: 'Condition',          value: toolCondition },
                      ...(toolExchangeType ? [{ label: 'Exchange Type', value: toolExchangeType === 'permanent' ? 'Permanent Exchange' : 'Borrow' }] : []),
                      ...(toolExchangeType === 'permanent'
                        ? [{ label: 'Exchange Date', value: startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('en-GB', { dateStyle: 'medium' }) + (timeStart ? ` at ${fmt12(timeStart)}` : '') : 'Not set' }]
                        : toolExchangeType === 'borrow'
                          ? [{ label: 'Borrow Period', value: startDate && borrowEndDate
                                ? `${new Date(startDate + 'T00:00:00').toLocaleDateString('en-GB', { dateStyle: 'medium' })} → ${new Date(borrowEndDate + 'T00:00:00').toLocaleDateString('en-GB', { dateStyle: 'medium' })}`
                                : 'Not set' }]
                          : startDate
                            ? [{ label: 'Available From', value: new Date(startDate + 'T00:00:00').toLocaleDateString('en-GB', { dateStyle: 'medium' }) }]
                            : []
                      ),
                      { label: 'Exchange Location',  value: locType === 'public' ? publicPlace || 'Not specified' : '[Private Location]' },
                    ] : []),
                    ...(postType === 'event' ? [
                      { label: 'Category', value: eventCategory },
                      { label: 'Date', value: eventDate ? new Date(eventDate).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set' },
                      { label: 'Location', value: (onlineVideo || onlineOnly) ? 'Online / Remote' : publicPlace || 'Not specified' },
                      { label: 'Capacity', value: eventCapacity ? `${eventCapacity} people` : 'Unlimited' },
                    ] : []),
                    ...(postType === 'question' ? [
                      { label: 'Category', value: questionCategory },
                      { label: 'Bounty (CEU)', value: `${bounty} CEU — awarded to best answer` },
                    ] : []),
                    { label: 'Tags', value: tags.length ? tags.map(t => `#${t}`).join(' ') : 'None' },
                  ].map(item => (
                    <Box key={item.label}>
                      <Box sx={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'uppercase',
                        letterSpacing: '0.05em', fontWeight: 600, mb: '0.375rem', fontFamily: 'Inter,sans-serif' }}>
                        {item.label}
                      </Box>
                      <Box sx={{ fontSize: '0.875rem', color: '#1F2937', fontWeight: 500, fontFamily: 'Inter,sans-serif' }}>
                        {item.value}
                      </Box>
                    </Box>
                  ))}
                </Box>

                {/* Content preview */}
                {content.trim() && (
                  <Box sx={{ pt: '1rem', borderTop: '1px solid #E5E7EB' }}>
                    <Box sx={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'uppercase',
                      letterSpacing: '0.05em', fontWeight: 600, mb: '0.5rem', fontFamily: 'Inter,sans-serif' }}>
                      Content Preview
                    </Box>
                    <Box sx={{
                      fontSize: '0.875rem', color: '#374151', fontFamily: 'Inter,sans-serif',
                      lineHeight: 1.7, whiteSpace: 'pre-line',
                      maxHeight: 200, overflow: 'auto',
                    }}>
                      {content}
                    </Box>
                  </Box>
                )}
              </SkillContainer>

              {/* Visibility recap */}
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '1rem', background: 'rgba(79,70,229,0.05)',
                border: '1px solid rgba(79,70,229,0.15)', borderRadius: '0.5rem',
              }}>
                <i className="fas fa-info-circle" style={{ color: '#4F46E5', flexShrink: 0 }} />
                <Box sx={{ fontSize: '0.8125rem', color: '#374151', fontFamily: 'Inter,sans-serif', lineHeight: 1.5 }}>
                  Your post will be {visPublic ? 'visible to the entire community' : 'private'}.
                  {visComments ? ' Comments are enabled.' : ' Comments are disabled.'}
                  {visNotify ? ' You\'ll receive notifications for responses.' : ''}
                </Box>
              </Box>
            </Box>
          )}
        </Box>

        {/* ── Action Bar ── */}
        <Box sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: { xs: '1.25rem 1.5rem', sm: '1.5rem 2rem' },
          borderTop: '1px solid #E5E7EB', background: '#F9FAFB',
          flexWrap: 'wrap', gap: '0.75rem',
        }}>
          {/* Left: Previous */}
          <Box>
            {step > 0 && (
              <Box component="button" type="button" onClick={goPrev} sx={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.875rem 2rem', borderRadius: '0.5rem',
                background: 'transparent', color: '#1F2937',
                border: '1px solid #E5E7EB', fontSize: '0.875rem', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'all 0.2s',
                '&:hover': { background: '#F3F4F6', borderColor: '#4F46E5', color: '#4F46E5' },
              }}>
                <i className="fas fa-arrow-left" /> Previous
              </Box>
            )}
          </Box>

          {/* Right: Discard + Skip + Next/Post */}
          <Box sx={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Skip to Review — only on Details step */}
            {step === 2 && (
              <Box component="button" type="button" onClick={() => { if (imageScanning) { setError('Please wait — media scan in progress.'); return; } setError(''); setStep(3); }} sx={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.875rem 1.5rem', borderRadius: '0.5rem',
                background: '#FFF', color: '#6B7280',
                border: '1px dashed #D1D5DB', fontSize: '0.875rem', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'all 0.2s',
                '&:hover': { borderColor: '#4F46E5', color: '#4F46E5', background: 'rgba(79,70,229,0.04)' },
              }}>
                Skip to Review <i className="fas fa-forward" />
              </Box>
            )}
            <Box component="button" type="button" onClick={() => navigate('/feed')} sx={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.875rem 2rem', borderRadius: '0.5rem',
              background: '#FFF', color: editId ? '#6B7280' : '#4F46E5',
              border: '1px solid #E5E7EB', fontSize: '0.875rem', fontWeight: 500,
              cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'all 0.2s',
              '&:hover': { background: '#F3F4F6', borderColor: editId ? '#9CA3AF' : '#4F46E5' },
            }}>
              {editId
                ? <><i className="fas fa-times" /> Cancel</>
                : <><i className="fas fa-save" /> Save Draft</>}
            </Box>

            {step < 3 ? (
              isPhoneVerified && !needsVerification && (
                <>
                  {/* Save Changes — edit mode only, available at any step */}
                  {editId && (
                    <Box component="button" type="button" onClick={handlePost} disabled={mutation.isPending || imageScanning} sx={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.875rem 2rem', borderRadius: '0.5rem',
                      background: '#FFF', color: '#4F46E5',
                      border: '2px solid #4F46E5', fontSize: '0.875rem', fontWeight: 600,
                      cursor: mutation.isPending ? 'not-allowed' : 'pointer',
                      fontFamily: 'Inter,sans-serif', transition: 'all 0.2s',
                      opacity: mutation.isPending ? 0.7 : 1,
                      '&:hover': !mutation.isPending ? { background: 'rgba(79,70,229,0.06)', transform: 'translateY(-1px)' } : {},
                    }}>
                      {mutation.isPending
                        ? <><i className="fas fa-spinner fa-spin" /> Saving…</>
                        : <><i className="fas fa-save" /> Save Changes</>}
                    </Box>
                  )}
                  <Box component="button" type="button" onClick={goNext} disabled={imageScanning} sx={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.875rem 2rem', borderRadius: '0.5rem',
                    background: imageScanning ? '#D1D5DB' : GRAD, color: '#FFF', border: 'none',
                    fontSize: '0.875rem', fontWeight: 600,
                    cursor: imageScanning ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter,sans-serif', transition: 'all 0.2s',
                    '&:hover': imageScanning ? {} : { opacity: 0.9, transform: 'translateY(-2px)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
                  }}>
                    {imageScanning
                      ? <><i className="fas fa-spinner fa-spin" /> Scanning media…</>
                      : <>Next Step <i className="fas fa-arrow-right" /></>}
                  </Box>
                </>
              )
            ) : (
              <Box component="button" type="button" onClick={handlePost} disabled={mutation.isPending || imageScanning} sx={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.875rem 2rem', borderRadius: '0.5rem',
                background: GRAD, color: '#FFF', border: 'none',
                fontSize: '0.875rem', fontWeight: 600,
                cursor: mutation.isPending ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter,sans-serif', transition: 'all 0.2s',
                opacity: mutation.isPending ? 0.7 : 1,
                '&:hover': !mutation.isPending ? { opacity: 0.9, transform: 'translateY(-2px)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' } : {},
              }}>
                {mutation.isPending
                  ? <><i className="fas fa-spinner fa-spin" /> {editId ? 'Saving…' : 'Posting…'}</>
                  : <><i className={editId ? 'fas fa-save' : 'fas fa-paper-plane'} /> {editId ? 'Save Changes' : 'Post to Community'}</>
                }
              </Box>
            )}
          </Box>
        </Box>
    </Box>
  );

  if (modal) {
    return (
      <Dialog open={open ?? false} onClose={onClose} maxWidth="lg" fullWidth
        PaperProps={{ sx: { borderRadius: '1rem', maxHeight: '92vh', m: '1rem' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: '1rem 1.5rem', borderBottom: '1px solid #E5E7EB', background: 'linear-gradient(135deg,#4F46E5,#10B981)', borderRadius: '1rem 1rem 0 0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <i className="fas fa-tools" style={{ color: '#fff', fontSize: '1rem' }} />
            <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', color: '#fff', fontFamily: 'Poppins,sans-serif' }}>
              Request to Borrow
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: '#fff', background: 'rgba(255,255,255,0.15)' } }}>
            <i className="fas fa-times" style={{ fontSize: '0.9rem' }} />
          </IconButton>
        </Box>
        <DialogContent sx={{ p: 0, overflowY: 'auto' }}>
          {formCard}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Layout>
      {/* ── Page Header ── */}
      <Box sx={{ mb: '2rem' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Box sx={{ width: 48, height: 48, borderRadius: '0.75rem', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: '1.25rem', flexShrink: 0 }}>
            <i className="fas fa-pen-nib" />
          </Box>
          <Box>
            <Box sx={{ fontFamily: 'Poppins,sans-serif', fontWeight: 700, fontSize: '2rem', color: '#1F2937', lineHeight: 1.2 }}>
              {editId ? 'Edit Post' : 'Create Post'}
            </Box>
            <Box sx={{ color: '#6B7280', fontSize: '1rem', mt: '0.25rem', maxWidth: 600 }}>
              {editId ? 'Update your post details below.' : 'Share your skills, tools, events or questions with your neighbourhood community.'}
            </Box>
          </Box>
        </Box>
      </Box>
      {formCard}
    </Layout>
  );
};

export default CreatePost;
