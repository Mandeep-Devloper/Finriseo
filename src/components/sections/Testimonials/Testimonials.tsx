import React from 'react';
import { Star } from 'lucide-react';
import styles from './Testimonials.module.css';


const TESTIMONIALS = [
  { name: 'Rahul Sharma', city: 'Delhi', stars: 5, text: 'Got ₹3 lakh in 4 hours. Process was completely digital.' },
  { name: 'Priya Patel', city: 'Ahmedabad', stars: 5, text: 'Compared 8 lenders in one place. Saved 2% on interest rate.' },
  { name: 'Amit Singh', city: 'Bengaluru', stars: 4, text: 'Zero paperwork as promised. Highly recommend.' },
  { name: 'Kavita Nair', city: 'Chennai', stars: 5, text: 'The EMI calculator helped me plan perfectly.' },
  { name: 'Neha Joshi', city: 'Pune', stars: 5, text: 'Got approved in 8 minutes. Smooth and transparent.' },
  { name: 'Vikas Kumar', city: 'Mumbai', stars: 4, text: 'Customer support was very helpful in guiding me through the process.' },
  { name: 'Sneha Reddy', city: 'Hyderabad', stars: 5, text: 'Finriseo made finding a business loan incredibly easy.' },
  { name: 'Rajesh Gupta', city: 'Kolkata', stars: 5, text: 'Best platform to compare loans. Highly transparent.' },
  { name: 'Pooja Desai', city: 'Surat', stars: 5, text: 'Very fast disbursal. Received the amount in my bank within hours.' },
  { name: 'Karan Malhotra', city: 'Chandigarh', stars: 4, text: 'Good experience overall. Much better than visiting multiple banks.' },
  { name: 'Anjali Verma', city: 'Lucknow', stars: 5, text: 'Secured an education loan seamlessly. Great service.' },
  { name: 'Sanjay Das', city: 'Jaipur', stars: 5, text: 'Lowest interest rates I could find. Very happy with Finriseo.' },
];

function getInitials(name: string) {
  const parts = name.split(' ');
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`;
  return name[0];
}

export default function Testimonials() {
  return (
    <section className={`section ${styles.section}`}>
      <div className="container">
        <header className="section-header">
          <h2 className="section-title">What Our Customers Say</h2>
          <p className="section-subtitle">Join thousands of Indians who found their perfect loan through Finriseo.</p>
        </header>

        <div className={styles.marqueeWrapper}>
          <div className={styles.marqueeTrack}>
            {[...TESTIMONIALS, ...TESTIMONIALS].map((testimonial, i) => (
              <div key={i} className={styles.card}>
                <div className={styles.stars}>
                  {[...Array(5)].map((_, index) => (
                    <Star 
                      key={index} 
                      size={16} 
                      className={index < testimonial.stars ? styles.starFilled : styles.starEmpty} 
                    />
                  ))}
                </div>
                <blockquote className={styles.quote}>
                  &quot;{testimonial.text}&quot;
                </blockquote>
                <div className={styles.author}>
                  <div className={styles.avatar}>
                    {getInitials(testimonial.name)}
                  </div>
                  <div>
                    <strong className={styles.authorName}>{testimonial.name}</strong>
                    <div className={styles.authorCity}>{testimonial.city}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
