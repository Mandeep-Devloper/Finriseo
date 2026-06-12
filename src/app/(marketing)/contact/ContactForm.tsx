'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Send, CheckCircle } from 'lucide-react';
import { contactService } from '@/lib/services';
import styles from './ContactForm.module.css';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter valid 10-digit mobile'),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  message: z.string().min(20, 'Message must be at least 20 characters'),
});

type FormData = z.infer<typeof schema>;

export default function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setSubmitError('');
    const { error } = await contactService.submit(data);
    setIsSubmitting(false);
    if (error) { setSubmitError(error); return; }
    setIsSuccess(true);
  };

  if (isSuccess) {
    return (
      <div className={styles.successBox}>
        <div className={styles.successIcon}>
          <CheckCircle size={40} strokeWidth={1.5} />
        </div>
        <h3 className={styles.successTitle}>Message Sent!</h3>
        <p className={styles.successText}>
          We will get back to you within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      <h2 className={styles.formTitle}>Send us a message</h2>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Your Name</label>
          <input {...register('name')} className={`${styles.input} ${errors.name ? styles.inputError : ''}`} placeholder="Rahul Sharma" />
          {errors.name && <p className={styles.error}>{errors.name.message}</p>}
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Mobile Number</label>
          <input {...register('phone')} className={`${styles.input} ${errors.phone ? styles.inputError : ''}`} placeholder="9876543210" maxLength={10} inputMode="numeric" />
          {errors.phone && <p className={styles.error}>{errors.phone.message}</p>}
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Email Address</label>
        <input {...register('email')} type="email" className={`${styles.input} ${errors.email ? styles.inputError : ''}`} placeholder="rahul@example.com" />
        {errors.email && <p className={styles.error}>{errors.email.message}</p>}
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Subject</label>
        <input {...register('subject')} className={`${styles.input} ${errors.subject ? styles.inputError : ''}`} placeholder="Question about personal loan" />
        {errors.subject && <p className={styles.error}>{errors.subject.message}</p>}
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Message</label>
        <textarea {...register('message')} className={`${styles.textarea} ${errors.message ? styles.inputError : ''}`} placeholder="Tell us how we can help..." rows={5} />
        {errors.message && <p className={styles.error}>{errors.message.message}</p>}
      </div>

      {submitError && <p className={styles.submitError}>{submitError}</p>}

      <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
        {isSubmitting ? (
          <><span className={styles.spinner} /> Sending...</>
        ) : (
          <><Send size={16} /> Send Message</>
        )}
      </button>
    </form>
  );
}
