import React, { useState, useRef, useEffect } from 'react';
import {
  Compass,
  LogOut,
  User as UserIcon,
  Edit3,
  Menu,
  X,
  LayoutDashboard,
  Calendar,
  Sparkles,
  Luggage,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { EditProfileModal } from '../profile/EditProfileModal';

export type NavViewId = 'dashboard' | 'my-trips' | 'trip-detail' | 'plan-trip' | 'surprise-me' | 'profile';

interface HeaderProps {
  currentView?: NavViewId;
  onNavigate?: (view: NavViewId) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView = 'dashboard',
  onNavigate,
}) => {
  const { user, profile, signOut, signInWithGoogle, isDemoUser } = useAuth();
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const displayName = profile?.displayName || user?.displayName || 'Traveler';
  const email = profile?.email || user?.email || '';
  const photoURL = profile?.photoURL || user?.photoURL;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavClick = (view: NavViewId) => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
    if (onNavigate) {
      onNavigate(view);
    }
  };

  const navItems: Array<{ id: NavViewId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'plan-trip', label: 'Plan a Trip', icon: Calendar },
    { id: 'surprise-me', label: 'Surprise Me', icon: Sparkles },
    { id: 'my-trips', label: 'My Trips', icon: Luggage },
  ];

  return (
    <>
      <header
        id="travelpilot-header"
        className="sticky top-0 z-30 w-full border-b border-[#E8E2D9] bg-[#F7F4EB]/90 backdrop-blur-md transition-all"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-17 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-6">
            <button
              type="button"
              id="brand-home-button"
              onClick={() => handleNavClick('dashboard')}
              className="flex items-center gap-3 group focus:outline-none text-left"
            >
              <div
                id="brand-logo-container"
                className="w-10 h-10 rounded-2xl bg-[#2E5658] text-white flex items-center justify-center shadow-xs transition-transform group-hover:scale-105"
              >
                <Compass className="w-5 h-5 text-[#FAF7F2]" />
              </div>
              <div>
                <span className="font-semibold text-xl tracking-tight text-[#1F2421] block leading-none">
                  TravelPilot
                </span>
                <span className="text-[11px] text-[#5C6460] font-medium tracking-wide">
                  Smart Travel Studio
                </span>
              </div>
            </button>

            {/* Desktop Navigation Links */}
            <nav
              id="desktop-navigation-bar"
              className="hidden md:flex items-center gap-1.5 ml-2 p-1 bg-[#FAF7F2] border border-[#E8E2D9] rounded-full shadow-2xs"
            >
              {navItems.map((item) => {
                const isActive =
                  currentView === item.id ||
                  (item.id === 'my-trips' && currentView === 'trip-detail');
                const IconComponent = item.icon;

                return (
                  <button
                    key={item.id}
                    id={`nav-link-${item.id}`}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[#2E5658] text-white shadow-2xs'
                        : 'text-[#5C6460] hover:text-[#1F2421] hover:bg-white/70'
                    }`}
                  >
                    <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-[#5C6460]'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Action: User Menu & Mobile Toggle */}
          <div className="flex items-center gap-2.5">
            {/* Authenticated User Menu Dropdown */}
            {user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  id="user-profile-menu-button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 bg-[#FAF7F2] hover:bg-white border border-[#E8E2D9] rounded-full transition-all text-left focus:outline-none focus:ring-2 focus:ring-[#2E5658]/30 shadow-2xs"
                >
                  {photoURL ? (
                    <img
                      src={photoURL}
                      alt={displayName}
                      className="w-7 h-7 rounded-full object-cover border border-[#E8E2D9]"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#EEF4F3] text-[#2E5658] flex items-center justify-center font-semibold text-xs border border-[#D3E2E0]">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs font-semibold text-[#1F2421] max-w-[110px] truncate hidden sm:inline-block">
                    {displayName.split(' ')[0]}
                  </span>
                  {isDemoUser && (
                    <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#EEF4F3] text-[#2E5658] border border-[#D3E2E0]">
                      Demo
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-[#5C6460] transition-transform duration-150" />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div
                    id="user-dropdown-menu"
                    className="absolute right-0 mt-2 w-60 rounded-2xl bg-white border border-[#E8E2D9] shadow-lg py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                  >
                    <div className="px-4 py-3 border-b border-[#E8E2D9] bg-[#FAF7F2]/50">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-semibold text-[#1F2421] truncate">
                          {displayName}
                        </p>
                        {isDemoUser && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#EBF3ED] text-[#2E5658] border border-[#D0E2D6]">
                            Demo User
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#5C6460] truncate mt-0.5">
                        {email}
                      </p>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        id="menu-btn-profile"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setIsEditProfileOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#1F2421] hover:bg-[#FAF7F2] transition-colors"
                      >
                        <UserIcon className="w-3.5 h-3.5 text-[#2E5658]" />
                        <span>Edit Profile</span>
                      </button>

                      <button
                        type="button"
                        id="menu-btn-my-trips"
                        onClick={() => handleNavClick('my-trips')}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#1F2421] hover:bg-[#FAF7F2] transition-colors"
                      >
                        <Luggage className="w-3.5 h-3.5 text-[#2E5658]" />
                        <span>My Trips</span>
                      </button>
                    </div>

                    <div className="border-t border-[#E8E2D9] pt-1">
                      {isDemoUser && (
                        <button
                          type="button"
                          id="menu-btn-connect-google"
                          onClick={async () => {
                            setIsUserMenuOpen(false);
                            try {
                              await signInWithGoogle();
                            } catch {
                              // Handled gracefully in AuthContext
                            }
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#2E5658] hover:bg-[#EEF4F3] transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#2E5658]" />
                          <span>Connect Google Account</span>
                        </button>
                      )}

                      <button
                        type="button"
                        id="menu-btn-signout"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          signOut();
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#CF8A70] hover:bg-[#FAF2EF] transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              id="btn-mobile-menu-toggle"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-[#5C6460] hover:text-[#1F2421] hover:bg-[#FAF7F2] border border-[#E8E2D9] transition-colors"
              aria-label="Toggle Navigation"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div
            id="mobile-navigation-drawer"
            className="md:hidden border-t border-[#E8E2D9] bg-[#F7F4EB] px-4 py-4 space-y-2 animate-in slide-in-from-top-2 duration-150"
          >
            {navItems.map((item) => {
              const isActive =
                currentView === item.id ||
                (item.id === 'my-trips' && currentView === 'trip-detail');
              const IconComponent = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#2E5658] text-white'
                      : 'text-[#5C6460] hover:bg-[#FAF7F2] hover:text-[#1F2421]'
                  }`}
                >
                  <IconComponent className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#5C6460]'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            <div className="pt-2 border-t border-[#E8E2D9] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsEditProfileOpen(true);
                }}
                className="flex items-center gap-2 text-xs font-semibold text-[#2E5658] p-2 hover:underline"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>

              <button
                type="button"
                onClick={() => signOut()}
                className="flex items-center gap-1.5 text-xs font-medium text-[#CF8A70] p-2 hover:underline"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />
    </>
  );
};
