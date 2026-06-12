import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { PageTransition } from '@/components/ui/Motion';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main id="main-content" style={{ paddingTop: '0px' }}>
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
    </>
  );
}
