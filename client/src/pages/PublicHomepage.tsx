import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/* ─────────────────────────── data ─────────────────────────── */

const featuredQuestions = [
  {
    category: 'Home Repair',
    categoryBg: '#e0e7ff',
    categoryColor: '#4F46E5',
    imgBg: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)',
    comments: 12,
    votes: 45,
    title: 'How do I fix a leaking bathroom faucet without replacing it?',
    avatar: 'MJ',
    author: 'Mike J.',
    icon: 'fas fa-wrench',
  },
  {
    category: 'Gardening',
    categoryBg: '#d1fae5',
    categoryColor: '#10B981',
    imgBg: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
    comments: 8,
    votes: 32,
    title: "What's the best way to start a vegetable garden in limited space?",
    avatar: 'SR',
    author: 'Sarah R.',
    icon: 'fas fa-seedling',
  },
  {
    category: 'Cooking',
    categoryBg: '#fce7f3',
    categoryColor: '#EC4899',
    imgBg: 'linear-gradient(135deg, #fce7f3, #fbcfe8)',
    comments: 15,
    votes: 67,
    title: 'Can someone share a good sourdough starter recipe for beginners?',
    avatar: 'PT',
    author: 'Priya T.',
    icon: 'fas fa-utensils',
  },
];

const trendingSkills = [
  {
    icon: 'fas fa-code',
    iconBg: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
    iconColor: '#10B981',
    category: 'Technology',
    rating: '4.8',
    ceu: '25 CEU/hr',
    title: 'Python Programming for Beginners',
    desc: 'Learn the basics of Python with hands-on projects',
    avatar: 'AK',
    author: 'Alex K.',
  },
  {
    icon: 'fas fa-seedling',
    iconBg: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
    iconColor: '#10B981',
    category: 'Gardening',
    rating: '4.9',
    ceu: '15 CEU/hr',
    title: 'Urban Gardening & Composting',
    desc: 'Maximize small spaces for sustainable gardening',
    avatar: 'SR',
    author: 'Sarah R.',
  },
  {
    icon: 'fas fa-guitar',
    iconBg: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
    iconColor: '#10B981',
    category: 'Music',
    rating: '4.7',
    ceu: '20 CEU/hr',
    title: 'Guitar Lessons for All Levels',
    desc: 'From basic chords to advanced techniques',
    avatar: 'DJ',
    author: 'David J.',
  },
];

const recentTools = [
  {
    icon: 'fas fa-tools',
    iconBg: 'linear-gradient(135deg, #fef3c7, #fde68a)',
    iconColor: '#92400e',
    category: 'Power Tools',
    condition: 'Excellent',
    ceu: '5 CEU/day',
    title: 'Cordless Drill & Impact Driver Set',
    desc: 'Brand new, used only twice. Includes charger and 2 batteries.',
    avatar: 'MJ',
    author: 'Michael J.',
  },
  {
    icon: 'fas fa-book',
    iconBg: 'linear-gradient(135deg, #fef3c7, #fde68a)',
    iconColor: '#92400e',
    category: 'Books',
    condition: 'Like New',
    ceu: '1 CEU/week',
    title: 'Complete Home Repair Manual',
    desc: 'Comprehensive guide with step-by-step instructions and illustrations.',
    avatar: 'LR',
    author: 'Lisa R.',
  },
  {
    icon: 'fas fa-utensils',
    iconBg: 'linear-gradient(135deg, #fef3c7, #fde68a)',
    iconColor: '#92400e',
    category: 'Kitchen',
    condition: 'Good',
    ceu: '3 CEU/day',
    title: 'Stand Mixer with Attachments',
    desc: 'Perfect for baking. Includes dough hook, whisk, and paddle.',
    avatar: 'PT',
    author: 'Priya T.',
  },
];

const communityEvents = [
  {
    icon: 'fas fa-leaf',
    imgBg: 'linear-gradient(135deg, #fce7f3, #fbcfe8)',
    category: 'Workshop',
    categoryBg: '#fce7f3',
    categoryColor: '#EC4899',
    attendees: '12/20',
    price: 'Free',
    title: "Beginner's Gardening Workshop",
    date: 'Sat, Jun 15 • 10:00 AM',
    location: 'Community Park',
    avatar: 'SR',
    author: 'Sarah R.',
  },
  {
    icon: 'fas fa-hammer',
    imgBg: 'linear-gradient(135deg, #fce7f3, #fbcfe8)',
    category: 'Skill Share',
    categoryBg: '#fce7f3',
    categoryColor: '#EC4899',
    attendees: '8/15',
    price: '5 CEU',
    title: 'Home Repair Basics: Fix Anything!',
    date: 'Tue, Jun 18 • 6:00 PM',
    location: 'Community Center',
    avatar: 'MJ',
    author: 'Michael J.',
  },
  {
    icon: 'fas fa-calendar-alt',
    imgBg: 'linear-gradient(135deg, #fce7f3, #fbcfe8)',
    category: 'Social',
    categoryBg: '#fce7f3',
    categoryColor: '#EC4899',
    attendees: '25/30',
    price: 'Free',
    title: 'Neighborhood Potluck & Skill Exchange',
    date: 'Sun, Jun 23 • 4:00 PM',
    location: 'Local Park Pavilion',
    avatar: 'CC',
    author: 'Community',
  },
];

const howItWorksSteps = [
  {
    num: '1',
    title: 'Create Profile',
    desc: 'Sign up with your email and location. Add the skills you can offer and skills you want to learn.',
  },
  {
    num: '2',
    title: 'Discover Opportunities',
    desc: 'Browse skills, tools, and questions in your area using our interactive neighborhood map.',
  },
  {
    num: '3',
    title: 'Connect & Exchange',
    desc: 'Message neighbors through our secure chat and schedule exchanges at mutually convenient times.',
  },
  {
    num: '4',
    title: 'Build Reputation',
    desc: 'Earn CEUs with each successful exchange. Level up from Bronze to Diamond and unlock benefits.',
  },
];

const STAT_DATA = [
  { icon: 'fas fa-users', color: '#4F46E5', target: 2850, label: 'Active Community Members' },
  { icon: 'fas fa-exchange-alt', color: '#10B981', target: 1845, label: 'Skills Successfully Exchanged' },
  { icon: 'fas fa-tools', color: '#F59E0B', target: 3210, label: 'Tools & Resources Shared' },
  { icon: 'fas fa-question-circle', color: '#8B5CF6', target: 5240, label: 'Community Questions Answered' },
];

/* ─────────────────── animated counter hook ─────────────────── */

function useCountUp(target: number, duration = 2000, trigger: boolean) {
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!trigger || done) return;
    setDone(true);
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [trigger, done, target, duration]);

  return count;
}

/* ─────────────────── StatCard with counter ─────────────────── */

const StatCard: React.FC<{ icon: string; color: string; target: number; label: string; trigger: boolean }> = ({
  icon, color, target, label, trigger,
}) => {
  const count = useCountUp(target, 2000, trigger);
  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <i className={icon} style={{ fontSize: '2.5rem', color, marginBottom: '1rem', display: 'block' }} />
      <div style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '2.5rem', color: '#111827', marginBottom: '0.5rem' }}>
        {count.toLocaleString()}{trigger ? '+' : ''}
      </div>
      <div style={{ color: '#4B5563', fontWeight: 500 }}>{label}</div>
    </div>
  );
};

/* ─────────────────── ContentCard ─────────────────── */

interface ContentCardProps {
  sectionClass: 'questions' | 'skills' | 'tools' | 'events';
  imgBg: string;
  icon: string;
  category: string;
  categoryBg: string;
  categoryColor: string;
  statLeft: React.ReactNode;
  statRight: React.ReactNode;
  title: string;
  desc?: React.ReactNode;
  avatar: string;
  author: string;
  actionLabel: string;
}

const cardImageIconColors: Record<string, string> = {
  questions: '#818CF8',
  skills: '#34D399',
  tools: '#FCD34D',
  events: '#F9A8D4',
};

const ContentCard: React.FC<ContentCardProps> = ({
  sectionClass, imgBg, icon, category, categoryBg, categoryColor,
  statLeft, statRight, title, desc, avatar, author, actionLabel,
}) => (
  <div
    style={{
      background: '#FFFFFF',
      borderRadius: '1rem',
      overflow: 'hidden',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
      border: '1px solid #E5E7EB',
      transition: 'transform 0.3s ease, box-shadow 0.3s ease',
      display: 'flex',
      flexDirection: 'column',
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-5px)';
      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1)';
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
    }}
  >
    {/* Card image area */}
    <div style={{
      height: 180,
      background: imgBg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: cardImageIconColors[sectionClass] || '#9CA3AF',
      fontSize: '3rem',
    }}>
      <i className={icon} />
    </div>

    {/* Card content */}
    <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <span style={{
          padding: '0.25rem 0.75rem',
          borderRadius: '1rem',
          fontSize: '0.75rem',
          fontWeight: 500,
          background: categoryBg,
          color: categoryColor,
        }}>
          {category}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#6B7280', fontSize: '0.875rem' }}>
          {statLeft}
          {statRight}
        </div>
      </div>

      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem', color: '#111827', fontFamily: 'Poppins, sans-serif', lineHeight: 1.3 }}>
        {title}
      </h3>

      {desc && (
        <div style={{ color: '#4B5563', fontSize: '0.875rem', marginBottom: '1rem', flex: 1 }}>
          {desc}
        </div>
      )}

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 'auto',
        paddingTop: '1rem',
        borderTop: '1px solid #E5E7EB',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '2rem',
            height: '2rem',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #4F46E5, #10B981)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: '0.75rem',
          }}>
            {avatar}
          </div>
          <span style={{ fontWeight: 500, color: '#374151', fontSize: '0.875rem' }}>{author}</span>
        </div>
        <a href="#" onClick={e => e.preventDefault()} style={{ color: '#4F46E5', textDecoration: 'none', fontWeight: 500, fontSize: '0.875rem' }}>
          {actionLabel}
        </a>
      </div>
    </div>
  </div>
);

/* ─────────────────── LoginPrompt ─────────────────── */

const LoginPrompt: React.FC<{ text: string; btnText: string; onClick: () => void }> = ({ text, btnText, onClick }) => (
  <div style={{
    background: '#F3F4F6',
    borderRadius: '1rem',
    padding: '1.5rem',
    textAlign: 'center',
    marginTop: '2rem',
    borderLeft: '4px solid #4F46E5',
  }}>
    <p style={{ marginBottom: '1rem', color: '#374151' }}>{text}</p>
    <button
      onClick={onClick}
      style={{
        background: 'linear-gradient(135deg, #4F46E5, #10B981)',
        color: '#fff',
        border: 'none',
        padding: '0.75rem 1.5rem',
        borderRadius: '0.5rem',
        fontWeight: 500,
        fontSize: '1rem',
        cursor: 'pointer',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {btnText}
    </button>
  </div>
);

/* ─────────────────── main component ─────────────────── */

const PublicHomepage: React.FC = () => {
  const navigate = useNavigate();
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /* Intersection observer for stat counters */
  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* Shared inline styles */
  const btnPrimary: React.CSSProperties = {
    background: 'linear-gradient(135deg, #4F46E5, #10B981)',
    color: '#fff',
    border: 'none',
    padding: '1rem 2rem',
    borderRadius: '0.75rem',
    fontWeight: 500,
    fontSize: '1.125rem',
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    textDecoration: 'none',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    boxShadow: '0 4px 6px -1px rgba(79,70,229,0.2)',
  };

  const btnSecondary: React.CSSProperties = {
    background: '#FFFFFF',
    color: '#374151',
    border: '1px solid #D1D5DB',
    padding: '1rem 2rem',
    borderRadius: '0.75rem',
    fontWeight: 500,
    fontSize: '1.125rem',
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    textDecoration: 'none',
    transition: 'background 0.2s ease',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#1F2937', background: '#F9FAFB', overflowX: 'hidden' }}>

      {/* ── HEADER ── */}
      <header style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(10px)',
        zIndex: 1000,
        boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.5rem' }}>
          <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0' }}>

            {/* Logo */}
            <a href="#" onClick={e => e.preventDefault()} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: '#1F2937' }}>
              <div style={{
                background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                width: '3rem', height: '3rem',
                borderRadius: '0.75rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '1.25rem',
                boxShadow: '0 4px 6px -1px rgba(79,70,229,0.2)',
              }}>
                <i className="fas fa-hands-helping" />
              </div>
              <div>
                <div style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.2 }}>
                  Neighborhood Exchange
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 400, marginTop: '0.125rem' }}>
                  Share Skills • Build Community
                </div>
              </div>
            </a>

            {/* Desktop nav links */}
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }} className="nav-links-desktop">
              {['#stats', '#questions', '#skills', '#tools', '#events', '#how-it-works'].map((href, i) => (
                <a
                  key={href}
                  href={href}
                  onClick={e => {
                    e.preventDefault();
                    const el = document.querySelector(href);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  style={{ textDecoration: 'none', color: '#374151', fontWeight: 500, transition: 'color 0.2s', fontSize: '0.9375rem' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#4F46E5')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#374151')}
                >
                  {['Stats', 'Questions', 'Skills', 'Tools', 'Events', 'How It Works'][i]}
                </a>
              ))}
              <a
                href="#"
                onClick={e => { e.preventDefault(); navigate('/login'); }}
                style={{ textDecoration: 'none', color: '#374151', fontWeight: 500, fontSize: '0.9375rem' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#4F46E5')}
                onMouseLeave={e => (e.currentTarget.style.color = '#374151')}
              >
                Login
              </a>
              <button
                onClick={() => navigate('/register')}
                style={{
                  background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                  color: '#fff',
                  border: 'none',
                  padding: '0.625rem 1.25rem',
                  borderRadius: '0.5rem',
                  fontWeight: 500,
                  fontSize: '0.9375rem',
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Sign Up
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(o => !o)}
              style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#374151', cursor: 'pointer', display: 'none' }}
              className="mobile-menu-btn-hp"
            >
              <i className="fas fa-bars" />
            </button>
          </nav>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div style={{ paddingBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {['#stats', '#questions', '#skills', '#tools', '#events', '#how-it-works'].map((href, i) => (
                <a
                  key={href}
                  href={href}
                  onClick={e => { e.preventDefault(); setMobileMenuOpen(false); document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' }); }}
                  style={{ textDecoration: 'none', color: '#374151', fontWeight: 500 }}
                >
                  {['Stats', 'Questions', 'Skills', 'Tools', 'Events', 'How It Works'][i]}
                </a>
              ))}
              <button onClick={() => navigate('/login')} style={{ background: 'none', border: '1px solid #D1D5DB', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500, color: '#374151' }}>Login</button>
              <button onClick={() => navigate('/register')} style={{ background: 'linear-gradient(135deg, #4F46E5, #10B981)', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>Sign Up</button>
            </div>
          )}
        </div>
      </header>

      {/* ── HERO ── */}
      <section style={{
        paddingTop: '8rem',
        paddingBottom: '5rem',
        background: 'linear-gradient(to bottom, #FFFFFF, #F9FAFB)',
        overflow: 'hidden',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4rem',
            alignItems: 'center',
          }}
            className="hero-grid"
          >
            {/* Left: text */}
            <div>
              <h1 style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                fontSize: '3.5rem',
                lineHeight: 1.2,
                color: '#111827',
                marginBottom: '1.5rem',
              }}>
                Connect with Neighbors.<br />Share Skills. Build Community.
              </h1>
              <p style={{ fontSize: '1.25rem', color: '#4B5563', marginBottom: '2rem', maxWidth: 500 }}>
                A hyper-local platform for non-monetary skill exchanges, tool sharing, and community Q&amp;A.
                Join thousands of neighbors building stronger communities.
              </p>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '3rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => navigate('/register')}
                  style={btnPrimary}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
                >
                  Join Your Neighborhood
                </button>
                <a
                  href="#how-it-works"
                  onClick={e => { e.preventDefault(); document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' }); }}
                  style={btnSecondary}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#F9FAFB'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#FFFFFF'; }}
                >
                  See How It Works
                </a>
              </div>

              {/* Hero stats */}
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                {[
                  { val: '2,500+', label: 'Neighbors Connected' },
                  { val: '1,800+', label: 'Skills Exchanged' },
                  { val: '3,200+', label: 'Tools Shared' },
                ].map(s => (
                  <div key={s.label}>
                    <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '2rem', color: '#4F46E5', marginBottom: '0.25rem', fontWeight: 700 }}>
                      {s.val}
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: map visual */}
            <div style={{ position: 'relative' }}>
              <div style={{
                width: '100%',
                height: 500,
                borderRadius: '1.5rem',
                background: 'linear-gradient(135deg, #e0e7ff, #d1fae5)',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              }}>
                {/* Streets horizontal */}
                {['20%', '50%', '80%'].map(top => (
                  <div key={top} style={{ position: 'absolute', top, left: 0, width: '100%', height: 3, background: 'rgba(255,255,255,0.7)', borderRadius: 2 }} />
                ))}
                {/* Streets vertical */}
                {['25%', '50%', '75%'].map(left => (
                  <div key={left} style={{ position: 'absolute', top: 0, left, height: '100%', width: 3, background: 'rgba(255,255,255,0.7)', borderRadius: 2 }} />
                ))}

                {/* Community buildings */}
                {[
                  { top: '15%', left: '15%', bg: '#8B5CF6', icon: 'fas fa-book', label: 'Library' },
                  { top: '15%', left: '65%', bg: '#3B82F6', icon: 'fas fa-users', label: 'Community Center' },
                  { top: '45%', left: '40%', bg: '#10B981', icon: 'fas fa-tree', label: 'Park' },
                  { top: '45%', left: '85%', bg: '#F59E0B', icon: 'fas fa-coffee', label: 'Cafe' },
                ].map(b => (
                  <div key={b.label} style={{
                    position: 'absolute', top: b.top, left: b.left,
                    width: 50, height: 50,
                    background: b.bg,
                    borderRadius: 8,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '1.2rem',
                    transform: 'translate(-50%, -50%)',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  }}>
                    <i className={b.icon} />
                    <span style={{
                      position: 'absolute', bottom: -25,
                      fontSize: '0.7rem', whiteSpace: 'nowrap',
                      color: '#374151', fontWeight: 500,
                      background: 'rgba(255,255,255,0.9)',
                      padding: '2px 6px', borderRadius: 4,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }}>{b.label}</span>
                  </div>
                ))}

                {/* Houses */}
                {[
                  { top: '30%', left: '10%' }, { top: '30%', left: '30%' }, { top: '30%', left: '70%' },
                  { top: '60%', left: '20%' }, { top: '60%', left: '60%' },
                  { top: '85%', left: '35%' }, { top: '85%', left: '75%' },
                ].map((h, i) => (
                  <div key={i} style={{
                    position: 'absolute', top: h.top, left: h.left,
                    width: 35, height: 35,
                    background: 'linear-gradient(135deg, #F3F4F6, #E5E7EB)',
                    borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#6B7280', fontSize: '1rem',
                    transform: 'translate(-50%, -50%)',
                    boxShadow: '0 3px 6px rgba(0,0,0,0.05)',
                    border: '1px solid rgba(209,213,219,0.5)',
                  }}>
                    <i className="fas fa-home" />
                  </div>
                ))}

                {/* Map markers */}
                {[
                  { top: '25%', left: '20%', color: '#4F46E5', shadow: 'rgba(79,70,229,0.2)' },
                  { top: '35%', left: '50%', color: '#10B981', shadow: 'rgba(16,185,129,0.2)' },
                  { top: '55%', left: '45%', color: '#F59E0B', shadow: 'rgba(245,158,11,0.2)' },
                  { top: '40%', left: '75%', color: '#4F46E5', shadow: 'rgba(79,70,229,0.2)' },
                  { top: '70%', left: '65%', color: '#10B981', shadow: 'rgba(16,185,129,0.2)' },
                  { top: '40%', left: '40%', color: '#F59E0B', shadow: 'rgba(245,158,11,0.2)' },
                  { top: '70%', left: '30%', color: '#4F46E5', shadow: 'rgba(79,70,229,0.2)' },
                ].map((m, i) => (
                  <div key={i} style={{
                    position: 'absolute', top: m.top, left: m.left,
                    width: 14, height: 14, borderRadius: '50%',
                    background: m.color,
                    boxShadow: `0 0 0 4px ${m.shadow}`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10,
                  }} />
                ))}

                {/* Meeting point */}
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: 45, height: 45,
                  background: 'linear-gradient(135deg, #FCD34D, #F59E0B)',
                  borderRadius: '50%',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '1.2rem',
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
                  animation: 'pulse-map 2s infinite',
                }}>
                  <i className="fas fa-handshake" />
                  <span style={{
                    position: 'absolute', bottom: -25,
                    fontSize: '0.7rem', whiteSpace: 'nowrap',
                    color: '#374151', fontWeight: 600,
                    background: 'rgba(255,255,255,0.95)',
                    padding: '2px 8px', borderRadius: 4,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}>Exchange Point</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse-map {
          0% { box-shadow: 0 0 0 0 rgba(245,158,11,0.4); }
          70% { box-shadow: 0 0 0 10px rgba(245,158,11,0); }
          100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
        }
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .nav-links-desktop { display: none !important; }
          .mobile-menu-btn-hp { display: block !important; }
        }
        @media (max-width: 600px) {
          .cards-grid-3 { grid-template-columns: 1fr !important; }
          .steps-grid-4 { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {/* ── PLATFORM STATS ── */}
      <section id="stats" style={{ background: '#FFFFFF', padding: '4rem 0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.5rem' }}>
          <div
            ref={statsRef}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '2rem',
              textAlign: 'center',
            }}
            className="cards-grid-4"
          >
            {STAT_DATA.map(s => (
              <StatCard key={s.label} {...s} trigger={statsVisible} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED QUESTIONS ── */}
      <section id="questions" style={{ padding: '4rem 0', background: '#F9FAFB' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={sectionHeaderStyle}>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '2rem', color: '#111827', fontWeight: 700 }}>
              Featured Questions
            </h2>
            <a href="#" onClick={e => { e.preventDefault(); navigate('/login'); }} style={{ color: '#4F46E5', textDecoration: 'none', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              View All Questions <i className="fas fa-arrow-right" />
            </a>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }} className="cards-grid-3">
            {featuredQuestions.map(q => (
              <ContentCard
                key={q.title}
                sectionClass="questions"
                imgBg={q.imgBg}
                icon="fas fa-question-circle"
                category={q.category}
                categoryBg={q.categoryBg}
                categoryColor={q.categoryColor}
                statLeft={<span><i className="fas fa-comment" style={{ marginRight: 4 }} />{q.comments}</span>}
                statRight={<span><i className="fas fa-arrow-up" style={{ marginRight: 4 }} />{q.votes}</span>}
                title={q.title}
                avatar={q.avatar}
                author={q.author}
                actionLabel="View Question"
              />
            ))}
          </div>

          <LoginPrompt
            text="Want to ask a question or join the discussion?"
            btnText="Login to Participate"
            onClick={() => navigate('/login')}
          />
        </div>
      </section>

      {/* ── TRENDING SKILLS ── */}
      <section id="skills" style={{ padding: '4rem 0', background: '#FFFFFF' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={sectionHeaderStyle}>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '2rem', color: '#111827', fontWeight: 700 }}>
              Trending Skills
            </h2>
            <a href="#" onClick={e => { e.preventDefault(); navigate('/login'); }} style={{ color: '#4F46E5', textDecoration: 'none', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Browse All Skills <i className="fas fa-arrow-right" />
            </a>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }} className="cards-grid-3">
            {trendingSkills.map(s => (
              <ContentCard
                key={s.title}
                sectionClass="skills"
                imgBg={s.iconBg}
                icon={s.icon}
                category={s.category}
                categoryBg="#d1fae5"
                categoryColor="#10B981"
                statLeft={<span><i className="fas fa-star" style={{ marginRight: 4 }} />{s.rating}</span>}
                statRight={<span>{s.ceu}</span>}
                title={s.title}
                desc={s.desc}
                avatar={s.avatar}
                author={s.author}
                actionLabel="Learn More"
              />
            ))}
          </div>

          <LoginPrompt
            text="Want to learn a new skill or teach what you know?"
            btnText="Login to Contact Teachers"
            onClick={() => navigate('/login')}
          />
        </div>
      </section>

      {/* ── RECENT TOOLS ── */}
      <section id="tools" style={{ padding: '4rem 0', background: '#F9FAFB' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={sectionHeaderStyle}>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '2rem', color: '#111827', fontWeight: 700 }}>
              Recent Tools Shared
            </h2>
            <a href="#" onClick={e => { e.preventDefault(); navigate('/login'); }} style={{ color: '#4F46E5', textDecoration: 'none', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Browse All Tools <i className="fas fa-arrow-right" />
            </a>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }} className="cards-grid-3">
            {recentTools.map(t => (
              <ContentCard
                key={t.title}
                sectionClass="tools"
                imgBg={t.iconBg}
                icon={t.icon}
                category={t.category}
                categoryBg="#fef3c7"
                categoryColor="#92400e"
                statLeft={<span>{t.condition}</span>}
                statRight={<span>{t.ceu}</span>}
                title={t.title}
                desc={t.desc}
                avatar={t.avatar}
                author={t.author}
                actionLabel="View Details"
              />
            ))}
          </div>

          <LoginPrompt
            text="Want to borrow tools or share yours with the community?"
            btnText="Login to Request Tools"
            onClick={() => navigate('/login')}
          />
        </div>
      </section>

      {/* ── COMMUNITY EVENTS ── */}
      <section id="events" style={{ padding: '4rem 0', background: '#FFFFFF' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={sectionHeaderStyle}>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '2rem', color: '#111827', fontWeight: 700 }}>
              Community Events
            </h2>
            <a href="#" onClick={e => { e.preventDefault(); navigate('/login'); }} style={{ color: '#4F46E5', textDecoration: 'none', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              View All Events <i className="fas fa-arrow-right" />
            </a>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }} className="cards-grid-3">
            {communityEvents.map(ev => (
              <ContentCard
                key={ev.title}
                sectionClass="events"
                imgBg={ev.imgBg}
                icon={ev.icon}
                category={ev.category}
                categoryBg={ev.categoryBg}
                categoryColor={ev.categoryColor}
                statLeft={<span><i className="fas fa-users" style={{ marginRight: 4 }} />{ev.attendees}</span>}
                statRight={<span>{ev.price}</span>}
                title={ev.title}
                desc={
                  <div>
                    <div><i className="far fa-calendar" style={{ marginRight: 6 }} />{ev.date}</div>
                    <div style={{ marginTop: 4 }}><i className="fas fa-map-marker-alt" style={{ marginRight: 6 }} />{ev.location}</div>
                  </div>
                }
                avatar={ev.avatar}
                author={ev.author}
                actionLabel="View Event"
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ background: '#F9FAFB', padding: '5rem 0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.5rem' }}>
          <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '2.5rem', fontWeight: 600, textAlign: 'center', marginBottom: '1rem', color: '#111827' }}>
            How Neighborhood Exchange Works
          </h2>
          <p style={{ fontSize: '1.125rem', color: '#4B5563', textAlign: 'center', maxWidth: 700, margin: '0 auto 3rem' }}>
            Join the community in four simple steps
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem', marginTop: '1rem' }} className="steps-grid-4">
            {howItWorksSteps.map((step, idx) => (
              <div key={step.num} style={{ textAlign: 'center', position: 'relative' }}>
                {/* Connector line */}
                {idx < howItWorksSteps.length - 1 && (
                  <div style={{
                    position: 'absolute',
                    top: '2rem',
                    right: '-1rem',
                    width: '2rem',
                    height: 2,
                    background: '#D1D5DB',
                  }} />
                )}
                {/* Step number circle */}
                <div style={{
                  width: '4rem', height: '4rem',
                  background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '1.5rem', fontWeight: 600,
                  margin: '0 auto 1.5rem',
                  boxShadow: '0 4px 6px -1px rgba(79,70,229,0.2)',
                  fontFamily: 'Poppins, sans-serif',
                }}>
                  {step.num}
                </div>
                <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.25rem', marginBottom: '0.75rem', color: '#111827', fontWeight: 600 }}>
                  {step.title}
                </h3>
                <p style={{ color: '#4B5563', fontSize: '0.9375rem' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA SECTION ── */}
      <section style={{
        background: 'linear-gradient(135deg, #4F46E5, #10B981)',
        color: '#fff',
        textAlign: 'center',
        padding: '6rem 0',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative wave overlay */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 100' preserveAspectRatio='none'%3E%3Cpath d='M0,0V100H1000V0C1000,0 800,50 500,50C200,50 0,0 0,0Z' fill='white' opacity='0.1'/%3E%3C/svg%3E")`,
          backgroundSize: 'cover',
        }} />
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.5rem', position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '3rem', fontWeight: 700, marginBottom: '1.5rem' }}>
            Ready to Build Your Local Community?
          </h2>
          <p style={{ fontSize: '1.25rem', marginBottom: '2rem', opacity: 0.9, maxWidth: 700, marginLeft: 'auto', marginRight: 'auto' }}>
            Join thousands of neighbors who are already sharing skills, tools, and knowledge.
            Create meaningful connections while saving money and reducing waste.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/register')}
              style={{
                background: '#FFFFFF',
                color: '#4F46E5',
                border: 'none',
                padding: '1rem 2rem',
                borderRadius: '0.75rem',
                fontWeight: 500,
                fontSize: '1.125rem',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
              onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
            >
              Sign Up Free
            </button>
            <a
              href="#how-it-works"
              onClick={e => { e.preventDefault(); document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' }); }}
              style={{
                background: 'transparent',
                color: '#fff',
                border: '2px solid rgba(255,255,255,0.3)',
                padding: '1rem 2rem',
                borderRadius: '0.75rem',
                fontWeight: 500,
                fontSize: '1.125rem',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                textDecoration: 'none',
                display: 'inline-block',
                transition: 'background 0.2s, border-color 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = '#fff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.3)'; }}
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#111827', color: '#D1D5DB', padding: '4rem 0 2rem' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.5rem' }}>
          {/* Footer grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '3rem', marginBottom: '3rem' }} className="footer-grid">

            {/* Brand column */}
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                    width: '3.5rem', height: '3.5rem',
                    borderRadius: '0.75rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '1.5rem',
                    marginBottom: '1rem',
                  }}>
                    <i className="fas fa-hands-helping" />
                  </div>
                </div>
                <div style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '1.25rem', color: '#fff', marginBottom: '0.25rem' }}>
                  Neighborhood Exchange
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Share Skills • Build Community</div>
              </div>
              <p style={{ color: '#9CA3AF', maxWidth: 300 }}>
                A community-focused platform for non-monetary skill and resource sharing among neighbors.
              </p>
            </div>

            {/* Platform column */}
            <div>
              <h4 style={{ color: '#fff', fontSize: '1.125rem', marginBottom: '1.5rem', fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>Platform</h4>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {[['#stats', 'Platform Stats'], ['#questions', 'Featured Questions'], ['#skills', 'Trending Skills'], ['#tools', 'Shared Tools'], ['#events', 'Community Events']].map(([href, label]) => (
                  <li key={href} style={{ marginBottom: '0.75rem' }}>
                    <a href={href} onClick={e => { e.preventDefault(); document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' }); }} style={{ color: '#9CA3AF', textDecoration: 'none', transition: 'color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                    >{label}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Community column */}
            <div>
              <h4 style={{ color: '#fff', fontSize: '1.125rem', marginBottom: '1.5rem', fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>Community</h4>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {['Community Guidelines', 'Safety Center', 'CEU System', 'Success Stories', 'Blog'].map(label => (
                  <li key={label} style={{ marginBottom: '0.75rem' }}>
                    <a href="#" onClick={e => e.preventDefault()} style={{ color: '#9CA3AF', textDecoration: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                    >{label}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support column */}
            <div>
              <h4 style={{ color: '#fff', fontSize: '1.125rem', marginBottom: '1.5rem', fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>Support</h4>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {['Help Center', 'Contact Us', 'Privacy Policy', 'Terms of Service', 'Cookie Policy'].map(label => (
                  <li key={label} style={{ marginBottom: '0.75rem' }}>
                    <a href="#" onClick={e => e.preventDefault()} style={{ color: '#9CA3AF', textDecoration: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                    >{label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Footer bottom */}
          <div style={{
            borderTop: '1px solid #1F2937',
            paddingTop: '2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>
              &copy; {new Date().getFullYear()} Neighborhood Exchange. All rights reserved.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {[
                { icon: 'fab fa-twitter', label: 'Twitter' },
                { icon: 'fab fa-facebook-f', label: 'Facebook' },
                { icon: 'fab fa-instagram', label: 'Instagram' },
                { icon: 'fab fa-linkedin-in', label: 'LinkedIn' },
              ].map(s => (
                <a
                  key={s.label}
                  href="#"
                  onClick={e => e.preventDefault()}
                  aria-label={s.label}
                  style={{
                    width: '2.5rem', height: '2.5rem',
                    borderRadius: '50%',
                    background: '#1F2937',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#9CA3AF',
                    textDecoration: 'none',
                    transition: 'background 0.2s, color 0.2s, transform 0.2s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#4F46E5'; (e.currentTarget as HTMLAnchorElement).style.color = '#fff'; (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#1F2937'; (e.currentTarget as HTMLAnchorElement).style.color = '#9CA3AF'; (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)'; }}
                >
                  <i className={s.icon} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicHomepage;
