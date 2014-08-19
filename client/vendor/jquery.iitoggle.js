/*global window,document,jQuery */

/*!
 * iiToggle: a jQuery Plugin
 * @author: Antti Salminen (anttis)
 * @url: lol
 * @documentation: bal
 * @published: 01/02/2012
 * @updated: 01/02/2012
 * @license wtfpl
 */

/*! This program is free software. It comes without any warranty, to
 * the extent permitted by applicable law. You can redistribute it
 * and/or modify it under the terms of the Do What The Fuck You Want
 * To Public License, Version 2, as published by Sam Hocevar. See
 * http://sam.zoy.org/wtfpl/COPYING for more details. */

if (typeof jQuery != 'undefined') {
  jQuery(function($) {
    $.fn.extend({
      iiToggle:function(options) {
        var radioButtons = this.filter(':radio')
        var checkBoxes = this.filter(':checkbox')
        if(checkBoxes.length) {
          return checkBoxes.each(function() {
            var elem = $(this)
            var iiT = new iiToggle(elem, options)
            elem.data('iiToggle', iiT)
          })
        }

        if(radioButtons.length) {
          var inputNames = _.uniq(radioButtons.map(function(){ return $(this).attr('name') }))
          $.each(inputNames, function(i, val){
            var elems = radioButtons.filter('[name='+ val + ']')
            var iiT = new iiToggle(elems, options)
            elems.data('iiToggle', iiT)
          })
        }
      }
    })


    function iiToggle(element, options) {
      options = options || {}

      var self = this
      var defaults = { onLabel: "On", offLabel: "Off" }
      var settings = $.extend({}, defaults, options)
      var isRadioButton = element.eq(0).is(':radio')

      var slider
      var container
      var sliderLabel
      var onLabel
      var offLabel

      this.createElements = function() {
        container = $('<div class="iit-container"></div>')
        slider = $('<div class="iit-slider"></div>')
        sliderLabel = $('<span></span>')
        offLabel = $('<div class="iit-off-label"><span></span></div>')
        onLabel = $('<div class="iit-on-label"><span></span></div>')

        slider.append(sliderLabel)
        container.append(onLabel,offLabel, slider)
      }

      this.initLabelTexts = function() {
        if(isRadioButton && !options.onLabel && !options.offLabel) { this.setupRadiobuttonLabels() }
        onLabel.text(settings.onLabel)
        offLabel.text(settings.offLabel)
        sliderLabel.text(settings.onLabel)
      }

      this.setupRadiobuttonLabels = function() {
        var originalOnLabelElement = $('label[for="' + element.eq(0).attr('id') + '"]')
        var originalOffLabelElement = $('label[for="' + element.eq(1).attr('id') + '"]')
        settings.onLabel = originalOnLabelElement.text()
        settings.offLabel = originalOffLabelElement.text()
        originalOnLabelElement.hide()
        originalOffLabelElement.hide()
      }

      this.initBindings = function() {
        slider
          .add(onLabel)
          .add(offLabel)
          .on('click', function() {
            var currentState = container.data('iit-state')
            var newState = currentState == 'on' ? 'off' : 'on';
            slider.animate({ left: newState == 'off' ? '50%' : '0%' }, 250, function() {
              self.updateState(newState)
              sliderLabel.text(newState == 'on' ? settings.onLabel : settings.offLabel)
              if(settings.callback) { settings.callback(newState) }
            })
          })
      }

      this.initState = function() {
        var checked = element.filter(':checked')
        var state = (!checked.length || element.index(checked) === 1) ? 'off' : 'on'
        if(state == 'off') {
          sliderLabel.text(settings.offLabel)
          slider.css('left', '50%')
        }
        setStateClass(slider, state)
        self.updateState(state)
      }

      this.updateCheckboxState = function(state) {
        container.data('iit-state', state)
        element.prop('checked', state == 'on').trigger('change')
        setStateClass(slider, state)
      }
      this.updateRadioState = function(state) {
        container.data('iit-state', state)
        element.eq(state == 'on' ? 0 : 1).prop('checked', true).trigger('change')
        setStateClass(slider, state)
      }

      this.updateState = isRadioButton ? this.updateRadioState : this.updateCheckboxState


      this.createElements()
      this.initLabelTexts()
      this.initState()
      this.initBindings()

      function setStateClass(slider, state) {
        slider.removeClass('on off').addClass(state)
      }

      element.hide()
      element.eq(0).after(container)

      return this
    }

  })
}
