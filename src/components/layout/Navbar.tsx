'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronDown } from 'lucide-react';
import { FinriseoLogo } from '@/components/ui/FinriseoLogo';
import styles from './Navbar.module.css';

const LOAN_PRODUCTS = [
  { label: 'Personal Loan', href: '/personal-loan' },
  { label: 'Business Loan', href: '/business-loan' },
  { label: 'Education Loan', href: '/education-loan' },
  { label: 'Pocket Loan', href: '/pocket-loan' },
  { label: 'Home Loan', href: '/home-loan' },
  { label: 'Medical Loan', href: '/medical-loan' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLLIElement>(null);

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  // Handle escape key to close menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setDropdownOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Body scroll lock when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Scroll detection for navbar background dynamically based on sections
  useEffect(() => {
    const handleScroll = () => {
      const darkSections = document.querySelectorAll('[data-theme="dark"]');
      let isDark = false;
      const navbarRect = document.querySelector('header[role="banner"]')?.getBoundingClientRect();
      const navbarCenterY = navbarRect ? navbarRect.top + (navbarRect.height / 2) : 44;

      darkSections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= navbarCenterY && rect.bottom >= navbarCenterY) {
          isDark = true;
        }
      });
      
      // Always show default state at the very top of any page
      if (window.scrollY < 50) {
        setScrolled(false);
        return;
      }

      // If we are over a dark section, we want the default white glass (!scrolled)
      // If we are over a light section, we want the green glass (scrolled)
      setScrolled(!isDark);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Small delay to ensure DOM is ready on first load
    setTimeout(handleScroll, 50);
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = () => setIsOpen(!isOpen);
  const isActive = (path: string) => pathname === path;
  const isDropdownActive = LOAN_PRODUCTS.map(p => p.href).includes(pathname);

  return (
    <div className={styles.navbarWrapper}>
      <header className={`${styles.navbar} ${scrolled ? styles.navbarScrolled : ''}`} role="banner">
        <Link href="/" className={styles.logo} aria-label="Finriseo Home">
          <FinriseoLogo 
            style={{ width: '124px', height: '32px' }} 
            textClassName={styles.logoTextPath}
          />
        </Link>

        <nav role="navigation" aria-label="Main Menu">
          <ul className={styles.navLinks}>
            <li 
              ref={dropdownRef}
              onMouseEnter={() => setDropdownOpen(true)}
              onMouseLeave={() => setDropdownOpen(false)}
              style={{ position: 'relative' }}
            >
              <button 
                className={`${styles.navLink} ${isDropdownActive ? styles.navLinkActive : ''}`}
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
                style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Loan Products
                <ChevronDown size={16} style={{ transition: 'transform 0.2s', transform: dropdownOpen ? 'rotate(180deg)' : 'none' }} />
              </button>
              
              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className={styles.dropdownMenu}>
                  {LOAN_PRODUCTS.map((product) => (
                    <Link 
                      key={product.href} 
                      href={product.href} 
                      className={styles.dropdownItem}
                    >
                      {product.label}
                    </Link>
                  ))}
                </div>
              )}
            </li>
            <li>
              <Link href="/emi-calculator" className={`${styles.navLink} ${isActive('/emi-calculator') ? styles.navLinkActive : ''}`}>
                EMI Calculator
              </Link>
            </li>
            <li>
              <Link href="/about" className={`${styles.navLink} ${isActive('/about') ? styles.navLinkActive : ''}`}>
                About Us
              </Link>
            </li>
            <li>
              <Link href="/contact" className={`${styles.navLink} ${isActive('/contact') ? styles.navLinkActive : ''}`}>
                Contact
              </Link>
            </li>
          </ul>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/apply" className={styles.navCta}>
            Apply Now
          </Link>
          <button 
            className={styles.hamburger} 
            onClick={toggleMenu}
            aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {isOpen && (
        <div className={styles.mobileMenu}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', padding: '0 16px' }}>Loan Products</span>
            {LOAN_PRODUCTS.map((product) => (
              <Link key={product.href} href={product.href} className={styles.mobileNavLink}>
                {product.label}
              </Link>
            ))}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '8px 0' }} />
            <Link href="/emi-calculator" className={styles.mobileNavLink}>EMI Calculator</Link>
            <Link href="/about" className={styles.mobileNavLink}>About Us</Link>
            <Link href="/contact" className={styles.mobileNavLink}>Contact</Link>
          </div>
          <Link href="/apply" className={styles.mobileCta} onClick={() => setIsOpen(false)}>
            Apply Now
          </Link>
        </div>
      )}
    </div>
  );
}
