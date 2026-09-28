import { Component, ElementRef, viewChild } from '@angular/core';
import { CONTACTS, CV_SUMMARY, EDUCATION, PROFILE, ROLES, SKILLS } from '../content/cv';

/** The recruiter's CV, rendered as HTML from the CV content in a modal over the journey. */
@Component({
  selector: 'app-cv-view',
  templateUrl: './cv-view.html',
  styleUrl: './cv-view.scss',
})
export class CvView {
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly profile = PROFILE;
  protected readonly contacts = CONTACTS;
  protected readonly summary = CV_SUMMARY;
  protected readonly roles = ROLES;
  protected readonly skills = SKILLS;
  protected readonly education = EDUCATION;

  open(): void {
    const dialog = this.dialog().nativeElement;
    dialog.showModal();
    dialog.scrollTop = 0;
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }
}
