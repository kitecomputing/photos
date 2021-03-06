import React from 'react';

import Navbar from './Navbar.js';

import { mintToken } from 'stork-js';
import { KiteImage, KiteLoadingIndicator } from 'stork-js/src/react.js';
import { KITE_URL, makeAbsoluteUrl } from './PhotoUrl.js';

import { Route, Link, withRouter } from 'react-router-dom';
import { MentionsInput, Mention } from 'react-mentions';
import reactGallery from 'react-photo-gallery';
import VisibilitySensor from 'react-visibility-sensor';

import './Gallery.scss';

import { Set } from 'immutable';

const E = React.createElement;

class MentionsParagraph extends React.Component {
    constructor() {
        super()

        this.state = { lastParagraph: '', tagRe: null, components: [] }
    }

    updateParagraph(desc) {
        var tagRe = this.state.tagRe
        if ( this.state.tagRe === null ||
             this.state.tagRe.source != this.props.re ) {
            tagRe = new RegExp(this.props.re, 'g')
            this.setState({tagRe})
        }

        var lastIndex = 0
        tagRe.lastIndex = 0

        var match, components = []
        while ( (match = tagRe.exec(desc)) !== null ) {
            if ( match.index > lastIndex ) {
                components.push({text: desc.substring(lastIndex, match.index)})
            }

            components.push({tag: match[1]})
            lastIndex = match.index + match[0].length
        }

        if ( lastIndex < desc.length )
            components.push({text: desc.substring(lastIndex, desc.length)})

        this.setState({lastParagraph: desc,
                       components})
    }

    componentDidMount() {
        this.updateParagraph(this.props.description)
    }

    componentDidUpdate(prevProps, prevState) {
        if ( this.props.description != prevProps.description )
            this.updateParagraph(this.props.description)
    }

    render() {
        var editBtn =
            E('span', {className: 'fa fa-fw fa-pencil ph-edit-btn'})

        var emptyClass
        if ( this.props.description.length == 0 )
            emptyClass = this.props.emptyClass

        return E('p', { className: `${this.props.className} ${emptyClass}`,
                        onClick: this.props.onClick },
                 this.state.components.length == 0 ? this.props.placeholder :
                 this.state.components.map((c) => {
                     if ( c.tag )
                         return E(this.props.MentionComponent, {id: c.tag})
                     else
                         return E('span', null, c.text)
                 }),
                editBtn)
    }
}

class ImageTile extends React.Component {
    constructor() {
        super()

        this.state = { editingDescription: false }
    }

    editDescription() {
        this.setState({ editingDescription: true,
                        editingValue: this.props.photo.description })
    }

    onTextAreaKey(e) {
        if ( e.keyCode == 27 ) {
            e.stopPropagation();
            e.preventDefault();
            this.setState({ editingDescription: false })
        } else if ( e.keyCode == 13 ) {
            this.props.onDescriptionSet(this.state.editingValue)
            e.stopPropagation();
            e.preventDefault();
            this.setState({ editingDescription: false,
                            editingValue: undefined })
        }
    }

    onClick() {
        if ( this.props.onActivated )
            this.props.onActivated()
    }

    onShare(e) {
        e.stopPropagation()

        alert(`Will share ${this.props.photo.id}`)
    }

    searchTags(search, cb) {
        var baseUrl = 'kite+app://photos.flywithkite.com/tag'
        if ( search.length > 0 )
            baseUrl += `?query=${encodeURIComponent(search)}`
        fetch(baseUrl)
            .then((r) => r.json())
            .then((tags) => {
                var results = [ { id: search, display: `#${search}` } ]
                results.push.apply(results, tags.map((tag) => { return { id: tag, display: `#${tag}` } }))

                return results
            })
            .then(cb)
    }

    render () {
        var mkDescription, editingClass = '', loadingClass = '', selectedClass = '', savingIcon


        if ( this.state.editingDescription ) {
            editingClass = 'ph-gallery-image-card--editing';
            mkDescription = () =>
              E('div', { onClick: (e) => { e.stopPropagation() } },
                E(MentionsInput,
                  { className: 'ph-image-description',
                    value: this.state.editingValue,
                    markup: '#[__display__](__id__)',
                    style: { suggestions: { 'backgroundColor': 'rgba(0,0,0,0.9)', 'position': 'fixed', zIndex: 10000 } },
                    suggestionsPortalHost: this.props.galleryNode,
                    onKeyDown: this.onTextAreaKey.bind(this),
                    onChange: (e, newVal) => {
                        this.setState({editingValue: newVal})
                    } },
                  E(Mention, { trigger: '#', type: 'tag',
                               data: this.searchTags.bind(this) })))
//            description = E('textarea', { className: 'ph-image-description',
//                                          onKeyDown: (e) => { this.onTextAreaKey(e) },
//                                          placeholder: 'Add description', autoFocus: true,
//                                          defaultValue: this.props.photo.description })
        } else {
            if ( this.props.photo.loading )
                editingClass = 'ph-gallery-image-card--saving';

            mkDescription = () =>
                E(MentionsParagraph, { re: '#\\[[#a-zA-Z0-9_\\-\'"]+\\]\\(([A-Za-z0-9_\\-\'"]+)\\)',
                                       className: 'ph-image-description',
                                       emptyClass: 'ph-image-description--empty',
                                       placeholder: 'Add description',
                                       onClick: (e) => {
                                           e.stopPropagation();
                                           this.editDescription()
                                       },
                                       MentionComponent: ({id}) => {
                                           var selectedClass = ""

                                           if ( this.props.selectedTags.contains(id) )
                                               selectedClass = 'ph-image-description__tag--selected';

                                           return E('a', { href: '#',
                                                           className: `ph-image-description__tag ${selectedClass}`,
                                                           onClick: (e) => {
                                                               e.stopPropagation()

                                                               if ( this.props.selectedTags.contains(id) )
                                                                   this.props.selectTag(id, false)
                                                               else
                                                                   this.props.selectTag(id, true)
                                                           }},
                                                    `#${id}`)
                                       },
                                       description: this.props.photo.description })
        }

        if ( this.props.photo.loading ) {
            savingIcon = E('span', { className: 'fa fa-fw fa-spin fa-circle-o-notch' })
        }

        if ( this.state.loaded )
            loadingClass = 'ph-gallery-image-card--loaded';
        else
            loadingClass = 'ph-gallery-image-card--loading';

        if ( this.props.selected )
            selectedClass = 'ph-gallery-image-card--selected';

        var size = Math.ceil(Math.max(this.props.photo.width, this.props.photo.height))
        size = Math.max(100, Math.round(Math.pow(2, Math.ceil(Math.log(size)/Math.log(2)))))

        return E('div', {className: `uk-card uk-card-default ph-gallery-image-card ${editingClass} ${loadingClass} ${selectedClass}`,
                         style: { width: `${this.props.photo.width}px`,
                                  height: `${this.props.photo.height}px`,
                                  margin: `${this.props.margin}px` },
                         onClick: () => { this.onClick() } },
                 E(KiteImage, {src: `${KITE_URL}/image/${this.props.photo.id}?size=${size}`,
                               style: {  width: `${this.props.photo.width}px`,
                                         height: `${this.props.photo.height}px` },
                               onFirstLoad: () => {
                                   setTimeout(() => { this.setState({loaded: true}) },
                                              200 * this.props.index)
                               },
                               className: 'ph-gallery-image uk-card-media-top'}),
                 E('div', { className: 'ph-image-selector',
                            onClick: (e) => { e.stopPropagation(); this.props.onSelect() } },
                   E('div', {className: 'ph-image-selector-check'},
                     E('span', {className: 'ph-image-selector-box'}))),
                 E('div', {className: 'uk-overlay uk-overlay-primary uk-light uk-position-bottom'},
                   E('p', {className: 'ph-image-meta'},
                     E('a', { className: 'uk-float-right', href: '#',
                              onClick: this.onShare.bind(this),
                              'uk-tooltip': 'Share this photo' },
                       E('i', { className: 'fa fa-fw fa-link' })),
                     this.props.photo.created,
                     savingIcon),
                   mkDescription()))
    }
}

class SlideshowImpl extends React.Component {
    constructor() {
        super()

        this.curSlide = null
    }

    componentDidMount() {
        this.keyHandler = (e) => {
            this.onKeyPress(e)
        }
        document.body.addEventListener('keydown', this.keyHandler)
    }

    componentWillUnmount() {
        document.body.removeEventListener('keydown', this.keyHandler)
    }

    onKeyPress(e) {
        var { history } = this.props

        if ( e.key == 'ArrowLeft' ||
             e.key == 'ArrowRight' ) {
            var { prevImage, nextImage } = this.slide

            if ( e.key == 'ArrowLeft' )
                history.replace(prevImage)
            else
                history.replace(nextImage)
        }
    }

    get slide() {
        if ( this.curSlide !== null && this.curSlide.curImage.id == this.props.imageId ) {
            return this.curSlide
        } else {
            var curImageIx = this.props.images.findIndex((img) => (img.id == this.props.imageId))
            if ( curImageIx >= 0 ) {
                var curImage = this.props.images[curImageIx]
                var prevImage, nextImage

                if ( curImageIx > 0 )
                    prevImage = this.props.images[curImageIx - 1].id

                if ( curImageIx < (this.props.images.length - 1) )
                    nextImage = this.props.images[curImageIx + 1].id

                var nextSlide = { curImage, prevImage, nextImage }
                this.curSlide = nextSlide

                console.log('return', nextSlide)
                return nextSlide
            } else
                return { }
        }
    }

    render() {
        var { curImage, prevImage, nextImage } = this.slide, imgComp

        if ( curImage === null || curImage === undefined ) {
            imgComp =
                E('p', { className: '' },
                  'This image was not found', E('br'),
                  E(Link, { to: this.props.parentRoute }, 'Click here to go back'))
        } else {
            imgComp =
                 E(KiteImage, { className: 'slide',
                                src: `${KITE_URL}/image/${curImage.id}` })
        }

        return E('div', { className: 'slideshow' },
                 imgComp,
                 E('nav', { className: 'uk-navbar-container uk-light uk-navbar-transparent',
                            'uk-navbar': 'uk-navbar' },
                   E('div', { className: 'uk-navbar-center' },
                     E('div', { className: `uk-navbar-item ${prevImage ? 'ss-nav-inactive' : ''}` },
                       E(Link, { to: (prevImage ? this.props.makeImageRoute(prevImage) : "") },
                         E('i', { className: 'fa fa-fw fa-3x fa-chevron-left' }))),
                     E('div', { className: `uk-navbar-item ${nextImage ? 'ss-nav-inactive' : ''}` },
                       E(Link, { to: (nextImage ? this.props.makeImageRoute(nextImage) : "") },
                         E('i', { className: 'fa fa-fw fa-3x fa-chevron-right' }))),
                     E('div', { className: 'uk-navbar-item' },
                       E(Link, { to: this.props.parentRoute },
                         E('i', { className: 'fa fa-fw fa-3x fa-times-circle' })),
                      ))))
    }
}

const Slideshow = withRouter(SlideshowImpl)

function ImageTileClosure({photo, index, margin}) {
    var img = photo
    var gallery = photo.gallery
    var { history, match } = gallery.props
    return E(ImageTile, { photo: img, key: img.id, margin,
                          index: index,
                          galleryNode: img.galleryRef,
                          selectedTags: gallery.props.selectedTags,
                          selectTag: gallery.props.selectTag,
                          selected: gallery.state.selected.contains(img.id),
                          onSelect: () => {
                              var { selected } = gallery.state

                              if ( selected.contains(img.id) )
                                  selected = selected.delete(img.id)
                              else
                                  selected = selected.add(img.id)

                              gallery.updateSelection(selected)
                          },
                          onActivated: () => {
                              history.push(`${match.url}slideshow/${img.id}`)
                          },
                          onDescriptionSet: (newDesc) => {
                              gallery.props.onImageDescriptionChanged(img.id, newDesc)
                          } })
}

export default class Gallery extends React.Component {
    constructor() {
        super()
        this.wasVisible = false
        this.galleryRef = React.createRef()
        this.state = {
            slideshow: false,
            curSlideIx: 0,
            selected: Set()
        }
    }

    render() {
        return [
            E(Route, { path: '/slideshow/:imageId', key: 'slideshow',
                       render: this.renderSlideshow.bind(this) }),
            E(Route, { path: '/', exact: true, key: 'gallery',
                       render: this.renderGallery.bind(this) })
        ]
    }

    shareSelected() {
        var perms = this.state.selected.toArray().map((img) => `kite+perm://photos.flywithkite.com/view/${img}`)

        perms.push('kite+perm://photos.flywithkite.com/gallery')
        perms.push('kite+perm://admin.flywithkite.com/guest')

        return mintToken(perms,  { format: 'query' })
                 .then((tok) => makeAbsoluteUrl('#/', tok))
    }

    setSelection(selected) {
        this.setState({selected})
    }

    selectAll() {
        if ( this.props.images !== undefined ) {
            var selected = Set(this.props.images.map((i) => i.id))
            this.updateSelection(selected)
        }
    }

    updateSelection(selected) {
        this.setSelection(selected)
        if ( this.props.onSelectionChanged )
            this.props.onSelectionChanged(selected)
    }

    onLoadIndicatorVisible(visible) {
        if ( visible && this.props.hasMore && !this.wasVisible ) {
            this.props.loadMore()
            this.wasVisible = true
        } else
            this.wasVisible = false
    }

    renderSlideshow(thisProps) {
        var { images, match } = this.props
        if ( images )
            return E(Slideshow, { images, imageId: thisProps.match.params.imageId,
                                  makeImageRoute: (id) => `${match.url}slideshow/${id}`,
                                  parentRoute: match.url })
        else
            return E('span', {className: 'fa fa-spin fa-large fa-circle-o-notch'})
    }

    renderGallery () {
        var gallery, galleryClass = '', hasSelection = !this.state.selected.isEmpty();

        if ( this.props.images === undefined ) {
            gallery = E('div', { className: 'ph-gallery-loading' }, 'Loading')
        } else if ( this.props.images.length == 0 ) {
            gallery = E('div', { className: 'ph-gallery-empty-msg' }, 'No images')
            galleryClass = 'ph-gallery-empty'
        } else {
            var photos =
                this.props.images.map((img) =>
                    Object.assign({ src:img.id, key:img.id, gallery: this },
                                  img))

            var visibilitySensor

            if ( this.props.hasMore )
                visibilitySensor = E(VisibilitySensor, { onChange: this.onLoadIndicatorVisible.bind(this) },
                                     E('div', { className: 'ph-gallery-loading-indicator' },
                                       E(KiteLoadingIndicator)))

            gallery =
                [ E(reactGallery,
                    { photos, margin: 2,
                      ImageComponent: ImageTileClosure }),
                  visibilitySensor ]

//this.props.images.map(
//    (img, index) =>
//        E(ImageTile, { photo: img, key: img.id, index: index,
//                       galleryNode: this.galleryRef.current,
//                       selected: this.state.selected.contains(img.id),
//                       onSelect: () => {
//                           var { selected } = this.state
//
//                           if ( selected.contains(img.id) )
//                               selected = selected.delete(img.id)
//                           else
//                               selected = selected.add(img.id)
//
//                           this.updateSelection(selected)
//                       },
//                       onActivated: () => {
//                           history.push(`${match.url}slideshow/${img.id}`)
//                       },
//                       onDescriptionSet: (newDesc) => {
//                           this.props.onImageDescriptionChanged(img.id, newDesc)
//                       }})
//)
        }

        return E('div', { className: `ph-gallery ${galleryClass}`, ref: this.galleryRef }, gallery)

//        return E('div', {className: `uk-flex uk-flex-wrap uk-flex-center ph-gallery ${galleryClass}`, 'uk-grid': 'uk-grid',
//                         ref: this.galleryRef },
//                 gallery)
    }
}
