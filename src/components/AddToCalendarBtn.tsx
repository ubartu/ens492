'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Course {
    id: string;
    title: string;
    schedule?: string | object;
    [key: string]: any;
}

interface SelectedCourse extends Course {
    color: string;
}

// Generate a color for each course (consistent with other components)
function generateCourseColor(index: number): string {
    const hues = [210, 280, 340, 30, 120, 180];
    const hue = hues[index % hues.length];
    return `hsla(${hue}, 70%, 50%, 0.85)`;
}

export default function AddToCalendarBtn({ course }: { course: Course }) {
    const [isAdded, setIsAdded] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const saved = localStorage.getItem('selectedCourses');
        if (saved) {
            const courses: SelectedCourse[] = JSON.parse(saved);
            setIsAdded(courses.some(c => c.id === course.id));
        }
    }, [course.id]);

    const handleToggle = () => {
        const saved = localStorage.getItem('selectedCourses');
        let courses: SelectedCourse[] = saved ? JSON.parse(saved) : [];

        if (isAdded) {
            // Remove
            courses = courses.filter(c => c.id !== course.id);
            setIsAdded(false);
        } else {
            // Add
            const newCourse: SelectedCourse = {
                ...course,
                color: generateCourseColor(courses.length)
            };
            courses.push(newCourse);
            setIsAdded(true);

            // Redirect to calendar on add
            // We use a small timeout to allow the state to update visually first if we wanted, 
            // but immediate redirect is requested.
            localStorage.setItem('selectedCourses', JSON.stringify(courses));
            router.push('/calendar');
            return;
        }

        localStorage.setItem('selectedCourses', JSON.stringify(courses));
    };

    return (
        <button
            onClick={handleToggle}
            className="sota-btn"
            style={{
                background: isAdded ? 'rgba(34, 197, 94, 0.2)' : 'var(--accent-gradient)',
                border: isAdded ? '1px solid rgba(34, 197, 94, 0.3)' : 'none',
                color: isAdded ? '#4ade80' : 'white',
                padding: '12px 24px',
                fontSize: '1rem',
                fontWeight: 600,
                boxShadow: isAdded ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
            }}
        >
            {isAdded ? (
                <>
                    <span>✓</span> Added to Schedule
                </>
            ) : (
                <>
                    <span>+</span> Add to Schedule
                </>
            )}
        </button>
    );
}
