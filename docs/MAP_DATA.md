# Regional locator map

Source: [us-atlas 3.0.1](https://github.com/topojson/us-atlas), derived from the U.S. Census Bureau’s 2017 cartographic state boundaries. Download: https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json

Bundled outlines are further simplified (0.035-degree tolerance); outer rings provide regional orientation only. This is not a navigation map, parcel boundary or ownership record. The displayed point comes from the existing Census geocoder address-range match. No lead address is sent to a map-tile service. Unsupported or missing coordinates display no pin.

License for the redistributed dataset:

Copyright 2013-2019 Michael Bostock

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.


## Compact property and Street View

The property card shows the submitted address and a lazy-loaded, interactive Google Street View iframe. No setup form, source badge, property listing link, or secondary address map is displayed inside the card. Lead details remain editable through the lead's Edit details action; evidence remains available in Sources.

A saved Google-generated panorama bound to the exact submitted address takes precedence. Otherwise the existing Google Maps hosted `layer=c`, `cbll`, `output=svembed` URL loads near fresh Census coordinates, without an API key or billing setup. Google redirects this to its hosted embed. This is the legacy hosted Maps embed, not the Maps Embed API v1 or a guaranteed API service. Keep the generated Google iframe and attribution intact.

Only fresh, finite, supported coordinates with a consistent street number may select automatic imagery. Invalid, stale, unmatched or inconsistent geography produces a short unavailable state instead of an unrelated map or image. Google's own frame handles imagery coverage failures. A panorama near an address does not establish the exact building, ownership, or a company relationship; imagery can be older.

Previously selected panorama URLs still accept only HTTPS www.google.com/maps/embed URLs with Google's Street View payload. User-provided HTML is never inserted. Saved panoramas remain visitor-scoped and address-bound; changing the address hides the prior selection. No research, qualification or reviewed email is changed by this presentation update.
