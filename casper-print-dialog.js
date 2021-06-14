/*
  - Copyright (c) 2014-2016 Cloudware S.A. All rights reserved.
  -
  - This file is part of casper-print-dialog.
  -
  - casper-print-dialog is free software: you can redistribute it and/or modify
  - it under the terms of the GNU Affero General Public License as published by
  - the Free Software Foundation, either version 3 of the License, or
  - (at your option) any later version.
  -
  - casper-print-dialog  is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  - GNU General Public License for more details.
  -
  - You should have received a copy of the GNU Affero General Public License
  - along with casper-print-dialog.  If not, see <http://www.gnu.org/licenses/>.
  -
 */

import '@cloudware-casper/casper-icons/casper-icon.js';
import '@cloudware-casper/casper-wizard/casper-wizard-page.js';
import { html } from '@polymer/polymer/polymer-element.js';
import { CasperWizard } from '@cloudware-casper/casper-wizard/casper-wizard.js';

class CasperPrintDialog extends CasperWizard {
  static get template() {
    return html`
      <style>
        :host {
          display: block;
          opacity: 0;
        }

        :host(.visible) {
          transition: opacity 0.5s;
          opacity: 1;
        }

        .iframe {
          overflow: auto;
          border: none;
          flex-grow: 2.0;
          width: 100%;
        }

        #print-dialog-overlay-holder {
          width: 100%;
          flex-grow: 2.0;
          position: relative;
          display: flex;
          flex-direction: column;
          margin-bottom: 42px;
        }

        #print-dialog-overlay {
          position:absolute;
          top:0;
          left:0;
          width:100%;
          height:100%;
          background: transparent;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        #print-dialog-overlay-message {
          height: 100%;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          background-color: rgba(0, 0, 0, 0.73);
          color: white;
          font-weight: bold;
        }

        .download_icon {
          width: 60px;
          height: 60px;
          color: #ff2f2f;
        }

      </style>

      <casper-wizard-page id="Print" title="Impressão" next="Cancelar">
        <div id="print-dialog-overlay-holder">
          <template is="dom-if" if="[[iframeOverlay]]">
            <div id="print-dialog-overlay">
              <div id="print-dialog-overlay-message" on-click="_openLinkInTab">
                <casper-icon icon="fa-light:file-pdf" class="download_icon"></casper-icon>
                <span>Carregue aqui para ver o seu PDF</span>
              </div>
            </div>
          </template>
          <iframe class="iframe" id="iframe" srcdoc$="[[srcdoc]]"></iframe>
        </div>
      </casper-wizard-page>
    `;
  }

  static get is () {
    return 'casper-print-dialog';
  }

  static get properties () {
    return {
      iframeOverlay: {
        type:  Boolean,
        value: false
      },
      fadeTimeoutObj: Object,
      errorMessage: {
        type: String,
        value: 'Ocorreu um erro ao efectuar esta operação e este foi reportado automaticamente. Tente novamente mais tarde.'
      }
    };
  }

  ready () {
    super.ready();
    this.addEventListener('opened-changed', e => this._onOpenedChanged(e));
    this.disablePrevious();
    this._iframe = this.$.iframe;
    this.iframeOverlay = CasperBrowser.isIos || CasperBrowser.isSafari;
    this._boundPrintFrame = this._printFrame.bind(this);
  }

  _onOpenedChanged (event) {
    if ( event.detail.value === true ) {
      this.removeAttribute('with-backdrop');
      this.className = '';
      this.setTitle(this.options.title || 'Impressão');
      this.setPageTitle('Print', this.options.pageTitle || 'Impressão Documento');
      this._clearIframe();
      this.fadeTimeoutObj = setTimeout(() => this._fadeIn(), 300);
      switch ( this.options.action ) {
      case 'subscribe-download':
      case 'subscribe-print':
        if ( this.options['job-id'] ) {
          this.subscribeJob(this.options['job-id'], this.options.timeout || 60);
        }
        break;
      case 'epaper-download':
      case 'epaper-print':
      default:
        let ttr, timeout;

        const isControlledJob = this.options.tube === 'job-controller';
        this.options.tube = !isControlledJob
          ? this.options.tube
          : this.options.destination_tube;

        switch (this.options.tube) {
          case 'casper-print-queue':
          case 'casper-print-queue-2':
            ttr      = this.options.ttr     || 250;   // Almost as big as the default database timeout
            timeout  = this.options.timeout || 72000; // 20h
            break;
          case 'casper-print-queue-hd':
          case 'casper-print-queue-2-hd':
            ttr      = this.options.ttr     || 36000; // Timeout will be controlled by the casper-print-queue
            timeout  = this.options.timeout || 72000; // 20h
            break;
          default:
            ttr      = this.options.ttr     || 250;   // Almost as big as the default database timeout
            timeout  = this.options.timeout || 72000; // 20h
            break;
        }

        // Check if there is a software notice stored in session.
        if (app.session_data.app.hasOwnProperty('certified_software_notice')) {
          this.options.overridable_system_variables = {
            CERTIFIED_SOFTWARE_NOTICE: app.session_data.app.certified_software_notice
          };
        }

        !isControlledJob
          ? this.submitJob(this.options, timeout, ttr)
          : this.submitControlledJob(this.options, timeout, ttr);
        break;
      }
    }
  }

  _clearIframe () {
    let doc = this._iframe.contentDocument || this._iframe.contentWindow.document;
    doc.documentElement.innerHTML = "";
  }

  _printFrame () {
    this._iframe.onload = undefined;
    this._iframe.focus();

    if (CasperBrowser.isIos) return this._fadeIn();
    if (CasperBrowser.isSafari) return this._openLinkInTab();
    this._iframe.contentWindow.print();
    this.close();
  }

  _fadeIn () {
    this.setAttribute('with-backdrop', true);
    this.className = "visible";
  }

  _print (url) {
    this._iframe.onload = this._boundPrintFrame;
    // ends here for now
    if ( CasperBrowser.isIos ) {
      this._xhrDownloadFile(url);
    } else {
      this._iframe.setAttribute('src', url);
    }
  }

  // Get the file through a http request
  _xhrDownloadFile (url) {
    //this._iframe.textContent = "Loading Loading Loading";
    let req = new window.XMLHttpRequest();
    req.responseType = 'arraybuffer';
    req.addEventListener('load', () => {
      if ( req.status === 200 ) {
        let localPdf = new window.Blob([req.response], {type: 'application/pdf'});
        this._iframe.setAttribute('src', window.URL.createObjectURL(localPdf));
        this._dataSrc = this._iframe.src;
      }
    });
    req.open('GET', url, true);
    req.send();
  }

  static getDateForFilename () {
    const  today = new Date();
    const  year = today.getFullYear();
    const  base_month = today.getMonth() + 1
    const  month = base_month.toString().length == 1 ? '0' + base_month : base_month;
    const  full_date = year + '-' + month;
    return full_date;
  }

  translateFilename (i18n_key, parameters) {
    if ( parameters.date === undefined ) {
      parameters.date = CasperPrintDialog.getDateForFilename();
    }
    try {
      return this.i18n.apply(this, [i18n_key, parameters]);
    } catch (e) {
      return i18n_key;
    }
  }

  _openLinkInTab () {
    this._openOnTab(this._dataSrc || this._iframe.src);
  }

  _openOnTab (publicLink) {
    try {
      let win = window.open(publicLink, 'printing_tab');
      win.focus();
      this.close();
    } catch (e) {
      this.close();
      console.error("PDF blocked");
    }
  }

  errorOnPrint (notification) {

    if (notification.detailed_error) {
      this.errorMessage = notification.message
    }

    // Don't display the job error directly if the message is not a custom one.
    if (!notification.custom) notification.message = [this.errorMessage];

    if (typeof this.options.on_job_failed === 'function') {
      this.options.on_job_failed(
        notification.status_code,
        notification.message,
        notification.response
      );
    }

    super.showStatusPage(notification);
    this._fadeIn();
  }

  jobCompletedOnPrint (status_code, message, response) {
    this.hideStatusAndProgress();
    this._dataSrc = response.public_link;

    if ( typeof this.options.on_job_completed === 'function' ) {
      if ( this.options.on_job_completed(status_code, message, response) === true ) {
        // Suppress default handling
        this.close();
        return;
      }
    }

    clearTimeout(this.fadeTimeoutObj);

    let publicLink = response.redirect && response.redirect.public_link ? response.redirect.public_link : response.public_link;

    switch (this.options['action']) {
      case 'subscribe-print':
      case 'epaper-print':

        if ( CasperBrowser.isFirefox || CasperBrowser.isEdge || CasperBrowser.isIE ) {
          this._openOnTab(publicLink);
        } else {
          this._print(publicLink);
        }
        break;
      case 'subscribe-download':
      case 'epaper-download':
      default:
        if ( status_code === 200 && publicLink !== undefined ) {
          if ( ! CasperBrowser.isIos ) {
            this._iframe.setAttribute('src', publicLink);
            this.close();
          }
        }
        break;
    }
  }
}

window.customElements.define(CasperPrintDialog.is, CasperPrintDialog);
