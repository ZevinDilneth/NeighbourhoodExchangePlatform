import React, { useState, useRef } from 'react';
import { Box, Avatar, Snackbar, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import Layout from '../components/layout/Layout';
import PublicPlacePicker from '../components/PublicPlacePicker';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const GRADIENT = 'linear-gradient(135deg, #4F46E5, #10B981)';
const GIFT_GRADIENT = 'linear-gradient(135deg, #10B981, #059669)';
const FONT = 'Inter, sans-serif';
const HEADING = 'Poppins, sans-serif';

const CONDITIONS = ['New', 'Excellent', 'Good', 'Fair'] as const;
type Condition = typeof CONDITIONS[number];

const SPEC_PRESETS = [
  'Fuel Type', 'Power Source', 'Maintenance', 'Weight', 'Dimensions',
  'Brand / Model', 'Age', 'Included Accessories', 'Safety Notes',
  'Operating Instructions', 'Storage Requirements', 'Noise Level',
];

interface SpecCategory {
  id: string;
  name: string;
  details: string[];
  newDetail: string;
}

interface GiftForm {
  title: string;
  description: string;
  condition: Condition | '';
  images: File[];
  imagePreviews: string[];
  startDate: string;
  endDate: string;
  timeStart: string;
  timeEnd: string;
}

const STEP_LABELS = ['Item Details', 'Exchange Info', 'Review'];

const cardSx = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '0.75rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  padding: '1.5rem',
  mb: '1rem',
};

const inputSx = {
  width: '100%',
  border: '1px solid #E5E7EB',
  borderRadius: '0.5rem',
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
  fontFamily: FONT,
  color: '#1F2937',
  background: '#FFFFFF',
  outline: 'none',
  boxSizing: 'border-box' as const,
  transition: 'border-color 0.15s',
  '&:focus': { borderColor: '#4F46E5' },
  '&::placeholder': { color: '#9CA3AF' },
};

const Label: React.FC<{ children: React.ReactNode; required?: boolean; hint?: string }> = ({ children, required, hint }) => (
  <Box component="label" sx={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#1F2937', mb: '0.5rem' }}>
    {children}
    {required && <Box component="span" sx={{ color: '#EF4444' }}> *</Box>}
    {hint && <Box component="span" sx={{ color: '#6B7280', fontWeight: 400, ml: '0.375rem' }}>{hint}</Box>}
  </Box>
);

/* ─── Step progress bar ─── */
const StepBar: React.FC<{ step: number }> = ({ step }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
    {STEP_LABELS.map((label, i) => (
      <React.Fragment key={i}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Box sx={{
            width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: i < step ? GIFT_GRADIENT : i === step ? GRADIENT : '#E5E7EB',
            color: i <= step ? '#fff' : '#6B7280', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0,
            transition: 'all 0.3s',
          }}>
            {i < step ? <i className="fas fa-check" style={{ fontSize: '0.6rem' }} /> : i + 1}
          </Box>
          <Box sx={{ fontSize: '0.8125rem', fontWeight: i === step ? 600 : 400, color: i === step ? '#1F2937' : '#6B7280' }}>
            {label}
          </Box>
        </Box>
        {i < STEP_LABELS.length - 1 && (
          <Box sx={{ flex: 1, height: 2, background: i < step ? GIFT_GRADIENT : '#E5E7EB', transition: 'background 0.3s', mx: '0.25rem' }} />
        )}
      </React.Fragment>
    ))}
  </Box>
);

/* ═══════════════════════════════════════════════════════ MAIN PAGE ══ */
const GiftCreate: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const specDropRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<GiftForm>({
    title: '', description: '', condition: '',
    images: [], imagePreviews: [],
    startDate: '', endDate: '', timeStart: '', timeEnd: '',
  });
  const [locationType, setLocationType] = useState<'public' | 'private'>('public');
  const [publicPlace, setPublicPlace]   = useState('');
  const [privatePlace, setPrivatePlace] = useState('');

  /* ── spec state ── */
  const [toolSpecs, setToolSpecs] = useState<SpecCategory[]>([]);
  const [specCatInput, setSpecCatInput] = useState('');
  const [specPresetOpen, setSpecPresetOpen] = useState(false);

  const specQ = specCatInput.trim().toLowerCase();
  const specSuggestions = SPEC_PRESETS.filter(p =>
    !toolSpecs.some(s => s.name === p) && (!specQ || p.toLowerCase().includes(specQ))
  );
  const isExactPreset = SPEC_PRESETS.some(p => p.toLowerCase() === specQ);

  const addSpecCat = (name: string) => {
    const n = name.trim();
    if (!n || toolSpecs.some(s => s.name === n)) return;
    setToolSpecs(prev => [...prev, { id: String(Date.now()), name: n, details: [], newDetail: '' }]);
    setSpecCatInput(''); setSpecPresetOpen(false);
  };

  const set = (field: keyof GiftForm, value: unknown) =>
    setForm((p) => ({ ...p, [field]: value }));

  const handleImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const combined = [...form.images, ...files].slice(0, 8);
    set('images', combined);
    set('imagePreviews', combined.map((f) => URL.createObjectURL(f)));
    e.target.value = '';
  };
  const removeImage = (idx: number) => {
    set('images', form.images.filter((_, i) => i !== idx));
    set('imagePreviews', form.imagePreviews.filter((_, i) => i !== idx));
  };

  const step0Valid = form.title.trim().length >= 3 && form.description.trim().length >= 10;
  const locationValue = locationType === 'public' ? publicPlace : privatePlace;
  const step1Valid = locationValue.trim().length > 0 && form.startDate.length > 0;

  const createMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('type', 'gift');
      fd.append('title', form.title.trim());
      fd.append('content', form.description.trim());
      if (form.condition) fd.append('condition', form.condition);
      if (locationValue) fd.append('locationName', locationValue.trim());
      fd.append('locationType', locationType);
      if (form.startDate) fd.append('startDate', form.startDate);
      if (form.endDate) fd.append('endDate', form.endDate);
      if (form.timeStart) fd.append('timeStart', form.timeStart);
      if (form.timeEnd) fd.append('timeEnd', form.timeEnd);
      const validSpecs = toolSpecs.filter(s => s.details.length > 0);
      if (validSpecs.length) fd.append('specifications', JSON.stringify(validSpecs.map(s => ({ name: s.name, details: s.details }))));
      fd.append('tags', JSON.stringify(['gift']));
      form.images.forEach((f) => fd.append('images', f));
      return api.post('/posts', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: (res) => {
      setToast({ msg: 'Gift post created!', sev: 'success' });
      setTimeout(() => navigate(`/posts/${res.data._id}`), 1200);
    },
    onError: () => setToast({ msg: 'Failed to create gift post. Try again.', sev: 'error' }),
  });

  /* ─── STEP 0: Item Details ─── */
  const renderStep0 = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Item Name */}
      <Box>
        <Label required>Item Name</Label>
        <Box component="input" value={form.title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('title', e.target.value)}
          placeholder="e.g. Cordless Drill, Wooden Chair, Vintage Lamp…"
          sx={inputSx} />
      </Box>

      {/* Photos / Videos */}
      <Box>
        <Label>Photos or Videos</Label>
        <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={handleImages} />
        {form.imagePreviews.length === 0 ? (
          <Box onClick={() => fileInputRef.current?.click()}
            sx={{ border: '2px dashed #E5E7EB', borderRadius: '0.5rem', p: '2rem', textAlign: 'center', cursor: 'pointer', background: '#F9FAFB', transition: 'all 0.15s', '&:hover': { borderColor: '#4F46E5', background: '#EEF2FF' } }}>
            <i className="fas fa-cloud-upload-alt" style={{ fontSize: '1.75rem', color: '#9CA3AF', marginBottom: '0.5rem', display: 'block' }} />
            <Box sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#6B7280' }}>Click to upload photos or videos</Box>
            <Box sx={{ fontSize: '0.75rem', color: '#9CA3AF', mt: '0.25rem' }}>Up to 8 files • JPG, PNG, MP4, etc.</Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {form.imagePreviews.map((src, i) => (
              <Box key={i} sx={{ position: 'relative', width: 88, height: 88, borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
                <Box component="img" src={src} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <Box component="button" onClick={() => removeImage(i)}
                  sx={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fas fa-times" />
                </Box>
              </Box>
            ))}
            {form.images.length < 8 && (
              <Box onClick={() => fileInputRef.current?.click()}
                sx={{ width: 88, height: 88, border: '2px dashed #E5E7EB', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9CA3AF', fontSize: '1.25rem', '&:hover': { borderColor: '#4F46E5', color: '#4F46E5' } }}>
                <i className="fas fa-plus" />
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Description */}
      <Box>
        <Label required>Description</Label>
        <Box component="textarea" value={form.description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('description', e.target.value)}
          placeholder="Describe the item — its history, why you're gifting it, any quirks…"
          sx={{ ...inputSx, minHeight: 120, resize: 'vertical' }} />
        <Box sx={{ fontSize: '0.75rem', color: '#9CA3AF', mt: '0.25rem', textAlign: 'right' }}>
          {form.description.length} / 2000
        </Box>
      </Box>

      {/* Condition */}
      <Box>
        <Label>Condition</Label>
        <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {CONDITIONS.map((c) => (
            <Box key={c} component="button" onClick={() => set('condition', form.condition === c ? '' : c)}
              sx={{
                px: '1rem', py: '0.5rem', borderRadius: '0.5rem',
                border: form.condition === c ? 'none' : '1px solid #E5E7EB',
                background: form.condition === c ? GIFT_GRADIENT : '#FFFFFF',
                color: form.condition === c ? '#fff' : '#374151',
                fontFamily: FONT, fontWeight: 600, fontSize: '0.875rem',
                cursor: 'pointer', transition: 'all 0.15s',
                '&:hover': { borderColor: '#10B981', background: form.condition === c ? GIFT_GRADIENT : '#F0FDF4' },
              }}>
              {c}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Item Specifications — category-based like Tool Specifications */}
      <Box>
        <Label hint="(optional)">Item Specifications</Label>

        {/* Existing spec categories */}
        {toolSpecs.map((cat, catIdx) => (
          <Box key={cat.id} sx={{ mb: '1rem', border: '1px solid #E5E7EB', borderRadius: '0.625rem', overflow: 'hidden' }}>
            {/* Category header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: '0.875rem', py: '0.5rem', background: 'rgba(79,70,229,0.05)', borderBottom: '1px solid #E5E7EB' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <i className="fas fa-tag" style={{ color: '#4F46E5', fontSize: '0.7rem' }} />
                <Box sx={{ fontWeight: 700, fontSize: '0.8125rem', color: '#1F2937', fontFamily: FONT }}>{cat.name}</Box>
              </Box>
              <Box component="button" type="button"
                onClick={() => setToolSpecs(prev => prev.filter((_, i) => i !== catIdx))}
                sx={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '0.75rem', p: '0.125rem 0.25rem', borderRadius: '0.25rem', '&:hover': { color: '#EF4444', background: '#FEE2E2' } }}>
                <i className="fas fa-times" />
              </Box>
            </Box>

            {/* Details list */}
            <Box sx={{ px: '0.875rem', pt: '0.5rem', pb: '0.625rem', background: '#FAFAFA' }}>
              {cat.details.map((detail, dIdx) => (
                <Box key={dIdx} sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', py: '0.25rem' }}>
                  <i className="fas fa-circle" style={{ color: '#4F46E5', fontSize: '0.35rem', flexShrink: 0 }} />
                  <Box sx={{ flex: 1, fontSize: '0.8125rem', color: '#374151', fontFamily: FONT }}>{detail}</Box>
                  <Box component="button" type="button"
                    onClick={() => setToolSpecs(prev => prev.map((c, ci) => ci !== catIdx ? c : { ...c, details: c.details.filter((_, di) => di !== dIdx) }))}
                    sx={{ border: 'none', background: 'none', cursor: 'pointer', color: '#D1D5DB', fontSize: '0.65rem', p: '0.125rem', '&:hover': { color: '#EF4444' } }}>
                    <i className="fas fa-times" />
                  </Box>
                </Box>
              ))}

              {/* Add detail input */}
              <Box sx={{ display: 'flex', gap: '0.5rem', mt: cat.details.length > 0 ? '0.5rem' : 0, pt: cat.details.length > 0 ? '0.5rem' : 0, borderTop: cat.details.length > 0 ? '1px dashed #E5E7EB' : 'none' }}>
                <Box component="input" type="text" value={cat.newDetail}
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
                  sx={{ flex: 1, px: '0.625rem', py: '0.375rem', border: '1px solid #E5E7EB', borderRadius: '0.375rem', fontSize: '0.8125rem', fontFamily: FONT, color: '#1F2937', outline: 'none', background: '#FFF', '&:focus': { borderColor: '#4F46E5' }, '&::placeholder': { color: '#9CA3AF' } }} />
                <Box component="button" type="button"
                  onClick={() => {
                    if (!cat.newDetail.trim()) return;
                    setToolSpecs(prev => prev.map((c, ci) => ci !== catIdx ? c : { ...c, details: [...c.details, c.newDetail.trim()], newDetail: '' }));
                  }}
                  sx={{ px: '0.625rem', py: '0.375rem', background: GRADIENT, color: '#FFF', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, fontFamily: FONT, whiteSpace: 'nowrap', '&:hover': { opacity: 0.88 } }}>
                  + Add
                </Box>
              </Box>
            </Box>
          </Box>
        ))}

        {/* Add category combobox */}
        <Box ref={specDropRef} sx={{ position: 'relative', maxWidth: 360 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', border: `1.5px solid ${specPresetOpen ? '#4F46E5' : '#E5E7EB'}`, borderRadius: '0.5rem', background: '#FFF', boxShadow: specPresetOpen ? '0 0 0 3px rgba(79,70,229,0.08)' : 'none', transition: 'border-color .15s, box-shadow .15s' }}>
            <i className="fas fa-plus" style={{ color: '#4F46E5', fontSize: '0.7rem', paddingLeft: '0.75rem', flexShrink: 0 }} />
            <Box component="input" type="text" value={specCatInput}
              placeholder="Add category — choose preset or type custom…"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSpecCatInput(e.target.value); setSpecPresetOpen(true); }}
              onFocus={() => setSpecPresetOpen(true)}
              onBlur={() => setTimeout(() => setSpecPresetOpen(false), 150)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') { e.preventDefault(); addSpecCat(specCatInput); }
                if (e.key === 'Escape') { setSpecCatInput(''); setSpecPresetOpen(false); }
              }}
              sx={{ flex: 1, px: '0.625rem', py: '0.5rem', border: 'none', outline: 'none', background: 'transparent', fontSize: '0.8125rem', fontFamily: FONT, color: '#1F2937', '&::placeholder': { color: '#9CA3AF' } }} />
            {specCatInput && (
              <Box component="button" type="button" onMouseDown={() => { setSpecCatInput(''); setSpecPresetOpen(false); }}
                sx={{ px: '0.5rem', border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '0.65rem', '&:hover': { color: '#6B7280' } }}>
                <i className="fas fa-times" />
              </Box>
            )}
            <Box component="button" type="button" onMouseDown={() => addSpecCat(specCatInput)}
              sx={{ px: '0.75rem', py: '0.5rem', background: GRADIENT, color: '#FFF', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.2)', cursor: specCatInput.trim() ? 'pointer' : 'default', opacity: specCatInput.trim() ? 1 : 0.45, fontSize: '0.75rem', fontWeight: 600, fontFamily: FONT, whiteSpace: 'nowrap', borderRadius: '0 0.375rem 0.375rem 0', transition: 'opacity .15s' }}>
              Add
            </Box>
          </Box>

          {specPresetOpen && (specSuggestions.length > 0 || (specQ && !isExactPreset)) && (
            <Box sx={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, background: '#FFF', border: '1.5px solid #E5E7EB', borderRadius: '0.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.10)', overflow: 'hidden' }}>
              {specSuggestions.length > 0 && (
                <Box sx={{ px: '0.75rem', pt: '0.4rem', pb: '0.25rem' }}>
                  <Box sx={{ fontSize: '0.67rem', fontWeight: 700, color: '#9CA3AF', fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Suggestions</Box>
                </Box>
              )}
              {specSuggestions.map(preset => (
                <Box key={preset} onMouseDown={() => addSpecCat(preset)}
                  sx={{ px: '0.875rem', py: '0.45rem', cursor: 'pointer', fontSize: '0.8125rem', color: '#1F2937', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: '0.5rem', '&:hover': { background: 'rgba(79,70,229,0.06)', color: '#4F46E5' } }}>
                  <i className="fas fa-tag" style={{ fontSize: '0.6rem', color: '#9CA3AF', width: 10 }} />
                  {preset}
                </Box>
              ))}
              {specQ && !isExactPreset && (
                <Box onMouseDown={() => addSpecCat(specCatInput)}
                  sx={{ px: '0.875rem', py: '0.45rem', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: '0.5rem', borderTop: specSuggestions.length > 0 ? '1px solid #F3F4F6' : 'none', background: '#FAFAFA', '&:hover': { background: 'rgba(79,70,229,0.06)' } }}>
                  <i className="fas fa-plus" style={{ fontSize: '0.6rem', color: '#4F46E5', width: 10 }} />
                  <Box component="span" sx={{ color: '#374151' }}>Add "<Box component="strong" sx={{ color: '#4F46E5' }}>{specCatInput}</Box>"</Box>
                </Box>
              )}
            </Box>
          )}
        </Box>

        <Box sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: FONT, mt: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <i className="fas fa-info-circle" style={{ fontSize: '0.65rem' }} />
          Add categories like Fuel Type, Weight, or Brand / Model to help recipients understand the item
        </Box>
      </Box>
    </Box>
  );

  /* ─── STEP 1: Exchange Info ─── */
  const renderStep1 = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Permanent Gift card */}
      <Box sx={{
        background: '#FFF', border: '2px solid #E5E7EB', borderRadius: '0.75rem', p: '1.5rem',
        transition: 'all 0.3s', '&:hover': { borderColor: '#10B981', transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' },
      }}>
        <Box sx={{ width: 56, height: 56, borderRadius: '0.75rem', background: GIFT_GRADIENT, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', mb: '1rem' }}>
          <i className="fas fa-gift" />
        </Box>
        <Box sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937', mb: '0.5rem', fontFamily: HEADING }}>Permanent Gift</Box>
        <Box sx={{ fontSize: '0.875rem', color: '#6B7280', mb: '1.5rem', lineHeight: 1.6, fontFamily: FONT }}>
          Propose a full ownership transfer — no return needed. Let your community know where and when to collect this item.
        </Box>
        <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['Free gift', 'No return needed', 'Community sharing'].map(tag => (
            <Box key={tag} component="span" sx={{ background: '#F0FDF4', color: '#059669', border: '1px solid #BBF7D0', borderRadius: '1rem', px: '0.625rem', py: '0.2rem', fontSize: '0.75rem', fontWeight: 600, fontFamily: FONT }}>
              {tag}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Exchange Location — Public / Private cards (same as ToolDetail) */}
      <Box>
        <Label required>Exchange Location</Label>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '1rem', mb: '1rem' }}>
          {([
            { key: 'public',  icon: 'fa-store', label: 'Public Place',     desc: 'Meet at a cafe, library, community center, or other public location' },
            { key: 'private', icon: 'fa-home',  label: 'Private Location', desc: 'Home or private location (requires secure sharing)' },
          ] as { key: 'public' | 'private'; icon: string; label: string; desc: string }[]).map(loc => {
            const active = locationType === loc.key;
            return (
              <Box key={loc.key} onClick={() => {
                setLocationType(loc.key);
                if (loc.key === 'public') setPrivatePlace('');
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
                <Box sx={{ fontWeight: 600, mb: '0.5rem', fontFamily: FONT, color: '#1F2937' }}>{loc.label}</Box>
                <Box sx={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: FONT }}>{loc.desc}</Box>
              </Box>
            );
          })}
        </Box>

        {/* Public Place picker */}
        {locationType === 'public' && (
          <Box>
            <Label required>Public Place Selection</Label>
            <PublicPlacePicker value={publicPlace} onChange={setPublicPlace} userCoordinates={undefined} />
            <Box sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: FONT, mt: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <i className="fas fa-shield-alt" style={{ fontSize: '0.65rem' }} />
              Search or click a pin on the map — public locations are recommended for safety
            </Box>
          </Box>
        )}

        {/* Private Location picker */}
        {locationType === 'private' && (
          <Box>
            <Label required>Location Selection</Label>
            <PublicPlacePicker value={privatePlace} onChange={setPrivatePlace} userCoordinates={undefined} />
            <Box sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: FONT, mt: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <i className="fas fa-lock" style={{ fontSize: '0.65rem' }} />
              Your exact location will only be shared securely after both parties confirm
            </Box>
            {/* Security notice */}
            <Box sx={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(245,158,11,0.1))', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.75rem', padding: '1.5rem', mt: '1rem' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', mb: '0.75rem' }}>
                <i className="fas fa-exclamation-triangle" style={{ color: '#EF4444', fontSize: '1.25rem' }} />
                <Box sx={{ fontWeight: 600, color: '#EF4444', fontFamily: HEADING }}>Important Security Notice</Box>
              </Box>
              {[
                'Your exact address will never be stored in chat logs',
                'Location will be shared via one-time secure link only',
                'Links expire automatically after the meeting time',
                'All location access is logged for security monitoring',
              ].map(item => (
                <Box key={item} sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', mb: '0.5rem' }}>
                  <i className="fas fa-check-circle" style={{ color: '#F59E0B', marginTop: 2, fontSize: '0.8rem', flexShrink: 0 }} />
                  <Box sx={{ fontSize: '0.875rem', color: '#374151', fontFamily: FONT }}>{item}</Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>

      {/* Pick-Up Date range */}
      <Box sx={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 180 }}>
          <Label required>Pick-Up Date</Label>
          <Box component="input" type="date" value={form.startDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('startDate', e.target.value)}
            sx={inputSx} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 180 }}>
          <Label>End Pick-Up Date</Label>
          <Box component="input" type="date" value={form.endDate}
            min={form.startDate || new Date().toISOString().split('T')[0]}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('endDate', e.target.value)}
            sx={inputSx} />
        </Box>
      </Box>

      {form.startDate && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '0.5rem', px: '0.875rem', py: '0.5rem' }}>
          <i className="fas fa-info-circle" style={{ color: '#10B981', fontSize: '0.75rem' }} />
          <Box sx={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#065F46', fontWeight: 500 }}>
            Permanent handover{form.endDate ? ` between ${new Date(form.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} and ${new Date(form.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ` on ${new Date(form.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
          </Box>
        </Box>
      )}

      {/* Time window */}
      <Box sx={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 140 }}>
          <Label>Available From</Label>
          <Box component="input" type="time" value={form.timeStart}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('timeStart', e.target.value)}
            sx={inputSx} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 140 }}>
          <Label>Until</Label>
          <Box component="input" type="time" value={form.timeEnd}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('timeEnd', e.target.value)}
            sx={inputSx} />
        </Box>
      </Box>
    </Box>
  );

  /* ─── STEP 2: Review ─── */
  const ReviewRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', py: '0.625rem', borderBottom: '1px solid #E5E7EB', '&:last-child': { borderBottom: 'none' }, gap: '1rem' }}>
      <Box sx={{ fontSize: '0.875rem', color: '#6B7280', flexShrink: 0 }}>{label}</Box>
      <Box sx={{ fontSize: '0.875rem', color: '#1F2937', fontWeight: 500, textAlign: 'right' }}>{value}</Box>
    </Box>
  );

  const renderStep2 = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Preview card */}
      <Box sx={{ border: '1px solid #E5E7EB', borderRadius: '0.5rem', overflow: 'hidden' }}>
        {form.imagePreviews.length > 0 && (
          <Box component="img" src={form.imagePreviews[0]} sx={{ width: '100%', height: 200, objectFit: 'cover' }} />
        )}
        <Box sx={{ p: '1rem 1.25rem' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.5rem' }}>
            <Box component="span" sx={{ background: GIFT_GRADIENT, color: '#fff', px: '0.625rem', py: '0.2rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 700 }}>
              <i className="fas fa-gift" style={{ marginRight: '0.3rem' }} />GIFT
            </Box>
            {form.condition && (
              <Box component="span" sx={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#6B7280', px: '0.625rem', py: '0.2rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600 }}>
                {form.condition}
              </Box>
            )}
          </Box>
          <Box sx={{ fontFamily: HEADING, fontWeight: 700, fontSize: '1.125rem', color: '#1F2937', mb: '0.375rem' }}>{form.title}</Box>
          <Box sx={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.6 }}>{form.description}</Box>
        </Box>
      </Box>

      {/* Details */}
      <Box sx={{ border: '1px solid #E5E7EB', borderRadius: '0.5rem', overflow: 'hidden' }}>
        <Box sx={{ px: '1.25rem', py: '0.75rem', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
          <Box sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Details</Box>
        </Box>
        <Box sx={{ px: '1.25rem' }}>
          {form.condition && <ReviewRow label="Condition" value={form.condition} />}
          {locationValue && <ReviewRow label="Collection Location" value={`${locationValue} (${locationType})`} />}
          {form.startDate && <ReviewRow label="Pick-Up Date" value={new Date(form.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />}
          {form.endDate && <ReviewRow label="End Pick-Up Date" value={new Date(form.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />}
          {(form.timeStart || form.timeEnd) && <ReviewRow label="Available" value={[form.timeStart, form.timeEnd].filter(Boolean).join(' – ')} />}
          {form.imagePreviews.length > 0 && <ReviewRow label="Photos" value={`${form.imagePreviews.length} uploaded`} />}
          {toolSpecs.filter(s => s.details.length > 0).length > 0 && (
            <ReviewRow label="Specifications" value={toolSpecs.filter(s => s.details.length > 0).map(s => `${s.name}: ${s.details.join(', ')}`).join(' · ')} />
          )}
        </Box>
      </Box>

      {/* Posted by */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', p: '0.875rem 1rem', border: '1px solid #E5E7EB', borderRadius: '0.5rem' }}>
        <Avatar src={user?.avatar} sx={{ width: 36, height: 36, background: GRADIENT, fontWeight: 700, fontSize: '0.875rem' }}>
          {user?.name?.[0]}
        </Avatar>
        <Box>
          <Box sx={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1F2937' }}>{user?.name}</Box>
          <Box sx={{ fontSize: '0.8125rem', color: '#6B7280' }}>Posting this gift</Box>
        </Box>
      </Box>
    </Box>
  );

  const canNext = step === 0 ? step0Valid : step1Valid;

  return (
    <Layout>
      <Box sx={{ px: { xs: '1rem', sm: '1.5rem' }, py: '1rem' }}>

        {/* Header Card */}
        <Box sx={{ ...cardSx, display: 'flex', alignItems: 'center', gap: '1rem', mb: '1.5rem' }}>
          <Box sx={{ width: 48, height: 48, borderRadius: '0.75rem', background: GIFT_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontSize: '1.25rem', flexShrink: 0 }}>
            <i className="fas fa-gift" />
          </Box>
          <Box>
            <Box sx={{ fontFamily: HEADING, fontWeight: 700, fontSize: '1.5rem', color: '#1F2937', lineHeight: 1.2 }}>
              Gift a Tool or Item
            </Box>
            <Box sx={{ color: '#6B7280', fontSize: '0.875rem', mt: '0.25rem' }}>
              Share something useful with your community
            </Box>
          </Box>
        </Box>

        {/* Step Progress Card */}
        <Box sx={{ ...cardSx }}>
          <StepBar step={step} />
        </Box>

        {/* Form Content Card */}
        <Box sx={{ ...cardSx, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
        </Box>

        {/* Nav Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Box component="button" onClick={() => step === 0 ? navigate(-1) : setStep((s) => s - 1)}
            sx={{ background: '#FFFFFF', border: '1px solid #E5E7EB', color: '#374151', borderRadius: '0.5rem', padding: '0.75rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.15s', '&:hover': { background: '#F3F4F6', borderColor: '#D1D5DB' } }}>
            {step === 0 ? <><i className="fas fa-times" /> Cancel</> : <><i className="fas fa-arrow-left" /> Back</>}
          </Box>

          {step < 2 ? (
            <Box component="button" disabled={!canNext} onClick={() => setStep((s) => s + 1)}
              sx={{ background: canNext ? GRADIENT : '#9CA3AF', color: '#FFFFFF', border: 'none', borderRadius: '0.5rem', padding: '0.75rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, cursor: canNext ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'opacity 0.2s', '&:hover': { opacity: canNext ? 0.9 : 1 } }}>
              Next Step <i className="fas fa-arrow-right" />
            </Box>
          ) : (
            <Box component="button" disabled={createMutation.isLoading} onClick={() => createMutation.mutate()}
              sx={{ background: createMutation.isLoading ? '#9CA3AF' : GIFT_GRADIENT, color: '#FFFFFF', border: 'none', borderRadius: '0.5rem', padding: '0.75rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, cursor: createMutation.isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'opacity 0.2s', '&:hover': { opacity: createMutation.isLoading ? 1 : 0.9 } }}>
              {createMutation.isLoading
                ? <><i className="fas fa-spinner fa-spin" /> Posting…</>
                : <><i className="fas fa-gift" /> Post Gift</>}
            </Box>
          )}
        </Box>
      </Box>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast?.sev ?? 'success'} onClose={() => setToast(null)}>{toast?.msg}</Alert>
      </Snackbar>
    </Layout>
  );
};

export default GiftCreate;
