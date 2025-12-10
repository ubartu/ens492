'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, FileText, Image, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TranscriptUploadProps {
  onCoursesExtracted: (courseCodes: string[]) => void;
}

// Extend Window type for libraries
declare global {
  interface Window {
    pdfjsLib: any;
    Tesseract: any;
  }
}

export default function TranscriptUpload({ onCoursesExtracted }: TranscriptUploadProps) {
  const [open, setOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'pdf' | 'screenshots' | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState('');
  const [librariesLoaded, setLibrariesLoaded] = useState({
    pdfjs: false,
    tesseract: false
  });

  // Load PDF.js and Tesseract.js libraries
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Load PDF.js
    if (!window.pdfjsLib) {
      const pdfScript = document.createElement('script');
      pdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      pdfScript.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          setLibrariesLoaded(prev => ({ ...prev, pdfjs: true }));
          console.log('✅ PDF.js loaded');
        }
      };
      document.head.appendChild(pdfScript);
    } else {
      setLibrariesLoaded(prev => ({ ...prev, pdfjs: true }));
    }

    // Load Tesseract.js
    if (!window.Tesseract) {
      const tesseractScript = document.createElement('script');
      tesseractScript.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
      tesseractScript.onload = () => {
        if (window.Tesseract) {
          setLibrariesLoaded(prev => ({ ...prev, tesseract: true }));
          console.log('✅ Tesseract.js loaded');
        }
      };
      document.head.appendChild(tesseractScript);
    } else {
      setLibrariesLoaded(prev => ({ ...prev, tesseract: true }));
    }
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      handleFiles(selectedFiles);
    }
  };

  const handleFiles = (newFiles: File[]) => {
    if (uploadType === 'pdf') {
      const pdfFile = newFiles.find(f => f.type === 'application/pdf');
      if (pdfFile) {
        setFiles([pdfFile]);
      } else {
        toast.error("Please upload a PDF file");
      }
    } else if (uploadType === 'screenshots') {
      const imageFiles = newFiles.filter(f => f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        setFiles(prev => [...prev, ...imageFiles].slice(0, 10));
      } else {
        toast.error("Please upload image files");
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Parse PDF client-side
  async function parsePDFClientSide(file: File): Promise<string[]> {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js not loaded');
    }

    setProgress('Reading PDF...');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    setProgress(`Processing ${pdf.numPages} pages...`);
    let textPages = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      textPages.push(content.items.map((item: any) => item.str).join(' '));
      setProgress(`Processing page ${pageNum}/${pdf.numPages}...`);
    }
    
    const fullText = textPages.join(' ');
    console.log('PDF text extracted, length:', fullText.length);
    
    setProgress('Extracting courses...');
    const courses = extractCoursesFromText(fullText);
    return Object.keys(courses);
  }

  // Parse screenshots client-side with OCR
  async function parseScreenshotsClientSide(files: File[]): Promise<string[]> {
    if (!window.Tesseract) {
      throw new Error('Tesseract.js not loaded');
    }

    const allCourses: any = {};

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`Processing image ${i + 1}/${files.length}...`);
      
      try {
        const { data: { text } } = await window.Tesseract.recognize(file, 'eng', {
          logger: (m: any) => {
            if (m.status === 'recognizing text') {
              setProgress(`Image ${i + 1}/${files.length}: ${Math.round(m.progress * 100)}%`);
            }
          }
        });
        
        console.log(`OCR text from image ${i + 1}:`, text.substring(0, 200));
        const courses = extractCoursesFromBannerweb(text);
        Object.assign(allCourses, courses);
      } catch (error) {
        console.error(`Error processing image ${i + 1}:`, error);
        toast.error(`Failed to process image ${i + 1}`);
      }
    }

    return Object.keys(allCourses);
  }

  // Extract courses from transcript text
  function extractCoursesFromText(text: string) {
    const courseMap = new Map();
    
    const pattern = /([A-Z]+)\s+(\d{3,4}[A-Z]?)\s+([\p{L}\s\.&\-']+?)\s+(UG|GR|FDY)\s+(A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F|S|U|W|I)\s+\d+\.\d+/gu;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const code = match[1] + match[2];
      const grade = match[5];
      
      const afterMatch = text.substring(match.index + match[0].length, match.index + match[0].length + 50);
      const isExcluded = afterMatch.includes('Excluded') || afterMatch.includes('Registered');
      
      if (!isExcluded && grade !== 'W' && grade !== 'I') {
        courseMap.set(code, { code, grade });
      }
    }
    
    return Object.fromEntries(courseMap);
  }

  // Extract courses from bannerweb OCR text
  function extractCoursesFromBannerweb(text: string) {
    const courses: any = {};
    const validGrades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'S', 'U'];
    
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine || trimmedLine.includes('COURSE CODE') || trimmedLine.includes('Term')) {
        continue;
      }
      
      // Fix common OCR errors
      let fixedLine = trimmedLine
        .replace(/\b([A-Z]{1,2})(\d)(\d{3})\b/g, (match, prefix, digitChar, rest) => {
          const digitToLetter: any = { '0': 'O', '1': 'I', '3': 'S', '5': 'S', '8': 'B' };
          const letter = digitToLetter[digitChar] || digitChar;
          return prefix + letter + ' ' + rest;
        });
      
      const match = fixedLine.match(/^([A-Z]+)\s+(\d{3}[A-Z]?)\s+.+?\s+(UG|FDY|GR)\s+([A-Z+\-]+)\s+(\d+\.\d+)/i);
      
      if (match) {
        const code = match[1].toUpperCase() + match[2];
        let grade = match[4].toUpperCase().trim();
        
        // Fix grade OCR errors
        if (grade.length === 2 && grade[0] === grade[1]) {
          grade = grade[0];
        }
        if (grade.length > 2 && !grade.includes('+') && !grade.includes('-')) {
          grade = grade.substring(0, 1);
        }
        
        if (validGrades.includes(grade) && !trimmedLine.includes('Excluded') && !trimmedLine.includes('Registered')) {
          courses[code] = { code, grade };
        }
      }
    }
    
    return courses;
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select files to upload");
      return;
    }

    setUploading(true);
    setProgress('Starting...');

    try {
      let courseCodes: string[] = [];

      if (uploadType === 'pdf') {
        if (!librariesLoaded.pdfjs) {
          throw new Error('PDF.js is still loading. Please wait a moment and try again.');
        }
        console.log('📄 Parsing PDF in browser...');
        courseCodes = await parsePDFClientSide(files[0]);
        
      } else if (uploadType === 'screenshots') {
        if (!librariesLoaded.tesseract) {
          throw new Error('Tesseract.js is still loading. Please wait a moment and try again.');
        }
        console.log('🖼️ Processing screenshots in browser...');
        courseCodes = await parseScreenshotsClientSide(files);
      }

      console.log('✅ Found courses:', courseCodes);

      // Success!
      toast.success(`Found ${courseCodes.length} courses in your transcript!`, {
        description: "They've been added to your profile",
      });

      onCoursesExtracted(courseCodes);

      // Reset and close
      setFiles([]);
      setUploadType(null);
      setProgress('');
      setOpen(false);

    } catch (error) {
      console.error('❌ Processing error:', error);
      toast.error("Failed to process transcript", {
        description: error instanceof Error ? error.message : "Please try again",
      });
    } finally {
      setUploading(false);
      setProgress('');
    }
  };

  const resetUpload = () => {
    setFiles([]);
    setUploadType(null);
    setProgress('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full gap-2 rounded-xl h-11"
        >
          <Upload className="w-4 h-4" />
          Upload Transcript
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload Your Transcript</DialogTitle>
          <DialogDescription>
            Choose how you want to upload your transcript
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
        {!uploadType ? (
          <div className="grid grid-cols-2 gap-4 py-4">
            <Card
              className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
              onClick={() => setUploadType('pdf')}
            >
              <CardContent className="flex flex-col items-center justify-center p-6 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="text-center">
                  <div className="font-semibold">PDF File</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Official transcript
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
              onClick={() => setUploadType('screenshots')}
            >
              <CardContent className="flex flex-col items-center justify-center p-6 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                  <Image className="w-6 h-6 text-accent" />
                </div>
                <div className="text-center">
                  <div className="font-semibold">Screenshots</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    From BannerWeb
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {uploadType === 'pdf' ? (
                  <FileText className="w-4 h-4 text-primary" />
                ) : (
                  <Image className="w-4 h-4 text-accent" />
                )}
                <span className="text-sm font-medium">
                  {uploadType === 'pdf' ? 'PDF Transcript' : `Screenshots (${files.length})`}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetUpload}
                disabled={uploading}
              >
                Change
              </Button>
            </div>

            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
                dragActive ? "border-primary bg-primary/5" : "border-border",
                files.length > 0 && "border-solid bg-secondary/50"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept={uploadType === 'pdf' ? '.pdf' : 'image/*'}
                multiple={uploadType === 'screenshots'}
                onChange={handleFileInput}
                disabled={uploading}
              />

              {files.length === 0 ? (
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-medium">
                      Drop your {uploadType === 'pdf' ? 'PDF' : 'images'} here
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      or click to browse
                    </div>
                  </div>
                  {uploadType === 'screenshots' && (
                    <div className="text-xs text-muted-foreground">
                      You can upload multiple screenshots
                    </div>
                  )}
                </label>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-background rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {uploadType === 'pdf' ? (
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <Image className="w-4 h-4 text-accent shrink-0" />
                        )}
                        <span className="text-sm truncate">{file.name}</span>
                      </div>
                      {!uploading && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="shrink-0"
                        >
                          <AlertCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  
                  {uploadType === 'screenshots' && files.length < 10 && !uploading && (
                    <label
                      htmlFor="file-upload"
                      className="flex items-center justify-center p-3 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors"
                    >
                      <span className="text-sm text-muted-foreground">
                        Add more images
                      </span>
                    </label>
                  )}
                </div>
              )}
            </div>

            {progress && (
              <div className="text-sm text-center text-muted-foreground">
                {progress}
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={files.length === 0 || uploading}
              className="w-full rounded-xl"
              size="lg"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Extract Courses
                </>
              )}
            </Button>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}