'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Search, Briefcase, BookOpen, Calendar, Plus, Check, Loader2, X, ArrowRight, Clock, Sparkles, GraduationCap, Zap, ChevronDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import TranscriptUpload from "@/components/TranscriptUpload";

interface Course {
  id: string;
  title: string;
  description: string;
  tags: string[];
  score: number;
  schedule?: string | object;
  location?: string;
  professor?: string;
  su_credits?: number;
  level?: string;
}

interface SelectedCourse extends Course {
  color: string;
}

interface SimpleCourse {
  id: string;
  title: string;
}

const COURSES_PER_PAGE = 12;

function normalizeId(id: string): string {
  return id.toLowerCase().replace(/\s+/g, '');
}

const MatchIndicator = memo(function MatchIndicator({ percent }: { percent: number }) {
  const { color, bgColor, label } = useMemo(() => {
    if (percent >= 85) return { 
      color: 'text-cyan-600 dark:text-cyan-400', 
      bgColor: 'bg-cyan-500/10 dark:bg-cyan-500/20',
      label: 'Excellent'
    };
    if (percent >= 70) return { 
      color: 'text-sky-600 dark:text-sky-400', 
      bgColor: 'bg-sky-500/10 dark:bg-sky-500/20',
      label: 'Great'
    };
    if (percent >= 55) return { 
      color: 'text-indigo-600 dark:text-indigo-400', 
      bgColor: 'bg-indigo-500/10 dark:bg-indigo-500/20',
      label: 'Good'
    };
    return { color: 'text-muted-foreground', bgColor: 'bg-secondary', label: 'Match' };
  }, [percent]);

  return (
    <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full", bgColor)}>
      <TrendingUp className={cn("w-3.5 h-3.5", color)} />
      <span className={cn("text-xs font-bold", color)}>{percent}%</span>
      <span className={cn("text-[10px] font-medium hidden sm:inline", color, "opacity-80")}>{label}</span>
    </div>
  );
});

export default function Home() {
  const [bio, setBio] = useState('');
  const [career, setCareer] = useState('');
  const [pastCourseIds, setPastCourseIds] = useState<string[]>([]);
  const [allRecommendations, setAllRecommendations] = useState<Course[]>([]);
  const [displayedCourses, setDisplayedCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([]);
  const [allCourses, setAllCourses] = useState<SimpleCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courseSearch, setCourseSearch] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAllCourses = async () => {
      try {
        const res = await fetch('/api/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bio: '', career: '', pastCourses: '' }),
        });
        if (res.ok) {
          const data = await res.json();
          const courses = data.courses || [];
          setAllCourses(courses.map((c: any) => ({ id: c.id, title: c.title })));
        }
      } catch {
        // Silently fail - course list is optional for command palette
      } finally {
        setLoadingCourses(false);
      }
    };
    fetchAllCourses();

    const savedSelected = localStorage.getItem('selectedCourses');
    if (savedSelected) {
      try {
        setSelectedCourses(JSON.parse(savedSelected));
      } catch {
        localStorage.removeItem('selectedCourses');
      }
    }

    const savedBio = localStorage.getItem('search_bio');
    const savedCareer = localStorage.getItem('search_career');
    const savedPastCourses = localStorage.getItem('search_pastCourseIds');

    if (savedBio) setBio(savedBio);
    if (savedCareer) setCareer(savedCareer);
    if (savedPastCourses) {
      try {
        setPastCourseIds(JSON.parse(savedPastCourses));
      } catch {
        setPastCourseIds([]);
      }
    }

  }, []);

  useEffect(() => {
    if (selectedCourses.length > 0) {
      const slimCourses = selectedCourses.map(c => ({
        id: c.id,
        title: c.title,
        su_credits: c.su_credits,
        schedule: c.schedule,
        sections: (c as any).sections,
        color: c.color,
        selectedSection: (c as any).selectedSection,
        score: c.score,
      }));
      localStorage.setItem('selectedCourses', JSON.stringify(slimCourses));
    } else {
      localStorage.removeItem('selectedCourses');
    }
  }, [selectedCourses]);

  const loadMoreCourses = useCallback(() => {
    const currentLength = displayedCourses.length;
    const nextCourses = allRecommendations.slice(currentLength, currentLength + COURSES_PER_PAGE);
    if (nextCourses.length > 0) {
      setDisplayedCourses(prev => [...prev, ...nextCourses]);
      setHasMore(currentLength + nextCourses.length < allRecommendations.length);
    } else {
      setHasMore(false);
    }
  }, [allRecommendations, displayedCourses.length]);

  useEffect(() => {
    if (!hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreCourses();
      },
      { threshold: 0.1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMoreCourses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommandOpen(false);
    setLoading(true);
    setError('');
    setAllRecommendations([]);
    setDisplayedCourses([]);
    setSearched(true);

    localStorage.setItem('search_bio', bio);
    localStorage.setItem('search_career', career);
    localStorage.setItem('search_pastCourseIds', JSON.stringify(pastCourseIds));

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio, career, pastCourses: pastCourseIds.join(', ') }),
      });
      if (!res.ok) throw new Error('Failed to fetch recommendations');
      const data = await res.json();
      const courses = data.courses || data;
      setAllRecommendations(courses);
      setDisplayedCourses(courses.slice(0, COURSES_PER_PAGE));
      setHasMore(courses.length > COURSES_PER_PAGE);
      toast.success(`Found ${courses.length} courses for you!`, {
        description: "Scroll down to explore your personalized recommendations",
      });
    } catch (err) {
      setError('Something went wrong. Please try again.');
      toast.error("Failed to get recommendations");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (displayedCourses.length > 0 && searched) {
      const resultsElement = document.getElementById('results-section');
      if (resultsElement && displayedCourses.length <= COURSES_PER_PAGE) {
        setTimeout(() => {
          resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [displayedCourses, searched]);

  const addCourse = (course: Course) => {
    setSelectedCourses(prev => [...prev, { ...course, color: '#f97316' }]);
    toast.success(`Added ${course.id}`, {
      description: course.title,
      action: {
        label: "View Schedule",
        onClick: () => window.location.href = '/calendar',
      },
    });
  };

  const removeCourse = (courseId: string) => {
    setSelectedCourses(prev => prev.filter(c => c.id !== courseId));
    toast.info(`Removed ${courseId}`);
  };

  const isCourseSelected = (courseId: string) => {
    return selectedCourses.some(c => c.id === courseId);
  };

  const addPastCourse = (courseId: string) => {
    if (!pastCourseIds.includes(courseId)) {
      setPastCourseIds([...pastCourseIds, courseId]);
    }
    setCourseSearch('');
    setCommandOpen(false);
  };

  const removePastCourse = (courseId: string) => {
    setPastCourseIds(pastCourseIds.filter(id => id !== courseId));
  };

  const handleTranscriptUpload = (courseCodes: string[]) => {
    const uniqueCourses = Array.from(new Set([...pastCourseIds, ...courseCodes]));
    setPastCourseIds(uniqueCourses);
    toast.success(`Added ${courseCodes.length} courses from transcript`, {
      description: `Total: ${uniqueCourses.length} courses selected`,
    });
  };

  const filteredCourses = useMemo(() => {
    return allCourses.filter(c => {
      if (pastCourseIds.includes(c.id)) return false;
      if (!courseSearch) return true;
      const searchNorm = normalizeId(courseSearch);
      const idNorm = normalizeId(c.id);
      const titleNorm = c.title.toLowerCase();
      return idNorm.includes(searchNorm) || titleNorm.includes(courseSearch.toLowerCase()) || c.id.toLowerCase().includes(courseSearch.toLowerCase());
    }).slice(0, 10);
  }, [allCourses, pastCourseIds, courseSearch]);

  const totalCredits = useMemo(() => 
    selectedCourses.reduce((sum, c) => sum + (c.su_credits || 0), 0),
    [selectedCourses]
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen relative overflow-hidden pb-24">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
        </div>

        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <header className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground mb-6 float shadow-xl shadow-primary/30 relative">
              <GraduationCap className="w-10 h-10" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg">
                <Zap className="w-3.5 h-3.5" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3 bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">
              Find your perfect courses
            </h1>
            <p className="text-muted-foreground text-lg">
              AI-powered recommendations for Sabanci University
            </p>
          </header>

          <Card className="mb-8 shadow-xl shadow-primary/5 border-0 bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary" />
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    What are you interested in?
                  </label>
                  <Textarea
                    rows={3}
                    placeholder="Tell us what excites you... e.g., I love machine learning, building apps, and analyzing data"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="rounded-2xl resize-none focus-visible:ring-primary/50 bg-background/50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-amber-500" />
                      Dream career
                    </label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Input
                          type="text"
                          placeholder="e.g., Data Scientist"
                          value={career}
                          onChange={(e) => setCareer(e.target.value)}
                          className="h-11 rounded-xl bg-background/50"
                        />
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>We&apos;ll recommend courses that align with your career goals</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-accent" />
                      Courses taken
                      {loadingCourses && <Loader2 className="w-3 h-3 animate-spin" />}
                    </label>

                    <div className="space-y-2">
                      <Popover open={commandOpen} onOpenChange={setCommandOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={commandOpen}
                            className="w-full h-11 justify-between rounded-xl bg-background/50 font-normal"
                          >
                            <span className="text-muted-foreground">Search courses...</span>
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-2xl" align="start">
                          <Command className="rounded-2xl">
                            <CommandInput
                              placeholder="Type course code or name..."
                              value={courseSearch}
                              onValueChange={setCourseSearch}
                            />
                            <CommandList>
                              <CommandEmpty>No course found.</CommandEmpty>
                              <CommandGroup heading="Courses">
                                {filteredCourses.map((course) => (
                                  <CommandItem
                                    key={course.id}
                                    value={`${course.id} ${course.title}`}
                                    onSelect={() => addPastCourse(course.id)}
                                    className="flex items-center gap-3 py-3 cursor-pointer"
                                  >
                                    <span className="font-mono text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-lg shrink-0">
                                      {course.id}
                                    </span>
                                    <span className="text-sm truncate">{course.title}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>

                      <TranscriptUpload onCoursesExtracted={handleTranscriptUpload} />
                    </div>
                  </div>
                </div>

                {pastCourseIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 animate-slide-up">
                    {pastCourseIds.map(id => (
                      <Badge key={id} className="gap-1.5 pr-1.5 bg-accent/10 text-accent border-accent/20 hover:bg-accent/20 rounded-full group">
                        <Check className="w-3 h-3" />
                        {id}
                        <button
                          type="button"
                          onClick={() => removePastCourse(id)}
                          className="ml-1 hover:bg-accent/20 rounded-full p-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  size="lg"
                  className="w-full h-12 rounded-2xl text-base font-semibold shadow-lg shadow-primary/25 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary transition-all"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Finding courses...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5 mr-2" />
                      Find my courses
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <section id="results-section">
            {error && (
              <Card className="mb-6 border-destructive/20 bg-destructive/5 animate-slide-up">
                <CardContent className="p-4 flex items-center gap-3 text-destructive">
                  <X className="w-5 h-5 shrink-0" />
                  {error}
                </CardContent>
              </Card>
            )}

            {displayedCourses.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Recommended for you
                  </h2>
                  <span className="text-sm text-muted-foreground">{allRecommendations.length} courses</span>
                </div>

                <div className="space-y-3">
                  {displayedCourses.map((course, idx) => {
                    const isSelected = isCourseSelected(course.id);
                    const matchPercent = Math.round(course.score * 100);

                    return (
                      <Link
                        key={course.id}
                        href={`/courses/${encodeURIComponent(course.id)}`}
                        className="block"
                      >
                        <Card
                          className={cn(
                            "card-hover animate-slide-up overflow-hidden cursor-pointer group",
                            isSelected && "ring-2 ring-primary ring-offset-2"
                          )}
                          style={{ animationDelay: `${Math.min(idx * 0.04, 0.2)}s` }}
                        >
                          <CardContent className="p-4 sm:p-5">
                            <div className="flex items-start gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  <Badge variant="outline" className="font-mono text-xs rounded-lg bg-secondary/50">
                                    {course.id}
                                  </Badge>
                                  {course.su_credits && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {course.su_credits} cr
                                    </span>
                                  )}
                                  <MatchIndicator percent={matchPercent} />
                                </div>

                                <h3 className="font-semibold text-base sm:text-lg line-clamp-2 group-hover:text-primary transition-colors">
                                  {course.title}
                                </h3>

                                <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                                  {course.description}
                                </p>

                                {course.tags && course.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                                    {course.tags.slice(0, 4).map(tag => (
                                      <span key={tag} className="text-xs px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full">
                                        {tag}
                                      </span>
                                    ))}
                                    {course.tags.length > 4 && (
                                      <span className="text-xs text-muted-foreground px-1.5 py-0.5">+{course.tags.length - 4}</span>
                                    )}
                                  </div>
                                )}
                              </div>

                              <Button
                                variant={isSelected ? "secondary" : "default"}
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (isSelected) {
                                    removeCourse(course.id);
                                  } else {
                                    addCourse(course);
                                  }
                                }}
                                className={cn("rounded-xl transition-all shrink-0", isSelected && "bg-primary/10 text-primary hover:bg-primary/20")}
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="w-4 h-4 mr-1.5" />
                                    Added
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-4 h-4 mr-1.5" />
                                    Add
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>

                {hasMore && (
                  <div ref={loaderRef} className="py-8 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}
              </div>
            )}

            {searched && !loading && displayedCourses.length === 0 && !error && (
              <div className="text-center py-16 animate-slide-up">
                <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center mx-auto mb-6">
                  <Search className="w-10 h-10 text-muted-foreground/40" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No courses found</h3>
                <p className="text-muted-foreground">Try different interests or career goals</p>
              </div>
            )}
          </section>
        </div>

        {selectedCourses.length > 0 && (
          <div className="fixed bottom-6 left-0 right-0 z-50 animate-slide-up">
            <div className="w-full max-w-3xl mx-auto px-4 sm:px-6">
              <Link href="/calendar" className="block">
                <Card className="shadow-2xl shadow-primary/20 border-primary/20 bg-card/95 backdrop-blur-md hover:shadow-primary/30 transition-all cursor-pointer group">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-lg relative shrink-0">
                        <Calendar className="w-6 h-6" />
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-accent-foreground text-[10px] font-bold rounded-full flex items-center justify-center shadow">
                          {selectedCourses.length}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold">{selectedCourses.length} course{selectedCourses.length > 1 ? 's' : ''} selected</div>
                        <div className="text-sm text-muted-foreground">{totalCredits} total credits</div>
                      </div>
                    </div>
                    <Button className="rounded-xl gap-2 group-hover:gap-3 transition-all shrink-0">
                      View Schedule
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
