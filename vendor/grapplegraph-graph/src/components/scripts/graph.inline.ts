// @ts-nocheck
import {
  removeAllChildren,
  getBasePath,
  getFullSlugFromUrl,
  simplifySlug,
  resolveBasePath,
} from "@quartz-community/utils";
import * as d3 from "d3";
import * as PIXI from "pixi.js";

(function () {
  function getSlugFromUrl() {
    var slug = getFullSlugFromUrl();
    var base = getBasePath();
    if (base && slug.startsWith(base.replace(/^\//, ""))) {
      slug = slug.slice(base.replace(/^\//, "").length);
      if (slug.startsWith("/")) slug = slug.slice(1);
    }
    return slug;
  }

  initGraph();

  function initGraph() {
    var localStorageKey = "graph-visited";

    function getVisited() {
      try {
        var stored = JSON.parse(localStorage.getItem(localStorageKey) || "[]");
        return new Set(Array.isArray(stored) ? stored : []);
      } catch (_) {
        return new Set();
      }
    }

    function addToVisited(slug) {
      var visited = getVisited();
      visited.add(slug);
      try {
        localStorage.setItem(localStorageKey, JSON.stringify(Array.from(visited)));
      } catch (_) {
        // Browsing modes that disable storage should not disable the graph.
      }
    }

    // Resolves CSS color values containing calc()/var() that PixiJS cannot parse.
    // Uses a temp DOM element so the browser's CSS engine evaluates the expression.
    function resolveColor(value, fallback) {
      if (!value) return fallback;
      var el = document.createElement("div");
      el.style.color = value;
      el.style.position = "absolute";
      el.style.visibility = "hidden";
      document.body.appendChild(el);
      var resolved = getComputedStyle(el).color;
      el.remove();
      return resolved || fallback;
    }

    async function renderGraph(graph, fullSlug, isCurrent) {
      function stale() {
        return typeof isCurrent === "function" && !isCurrent();
      }

      var slug = simplifySlug(fullSlug);
      if (slug === "") slug = "index";
      var visited = getVisited();
      removeAllChildren(graph);

      if (stale()) return function () {};

      var config = JSON.parse(graph.dataset["cfg"] || "{}");
      var enableDrag = config.drag;
      var enableZoom = config.zoom;
      var depth = config.depth;
      var scale = config.scale || 1;
      var repelForce = config.repelForce || 0.5;
      var centerForce = config.centerForce || 0.3;
      var linkDistance = config.linkDistance || 30;
      var fontSize = config.fontSize || 0.6;
      var opacityScale = config.opacityScale || 1;
      var removeTags = config.removeTags || [];
      var showTags = config.showTags;
      var focusOnHover = config.focusOnHover;
      var enableRadial = config.enableRadial;
      var currentPath = window.location.pathname.replace(/\/+$/, "");
      var configuredBasePath = getBasePath().replace(/\/+$/, "");
      var isHome = currentPath === "" || currentPath === configuredBasePath;
      if (slug === "index" || isHome) depth = -1;

      var data;
      try {
        var dataRaw = await fetchData;
        data = new Map();
        for (var key in dataRaw) {
          data.set(simplifySlug(key), dataRaw[key]);
        }
      } catch (err) {
        console.error("[Graph] Error loading data:", err);
        return function () {};
      }
      if (stale()) return function () {};

      var graphRoot = graph.closest(".graph");
      function filterValue(name) {
        var control = graphRoot?.querySelector('[data-graph-filter="' + name + '"]');
        return control?.value || "all";
      }

      var beltFilter = filterValue("belt");
      var familyFilter = filterValue("family");
      var typeFilter = filterValue("type");
      var progressFilter = filterValue("progress");
      var progress = {};
      try {
        progress = JSON.parse(localStorage.getItem("grapplegraph-progress-v1") || "{}");
      } catch (_) {}

      function progressMatches(id) {
        if (progressFilter === "all") return true;
        var state = progress[id] || "not-started";
        return state === progressFilter;
      }

      var hasContextFilter =
        beltFilter !== "all" || familyFilter !== "all" || progressFilter !== "all";
      var matchingTechniques = new Set();
      var contextualNodes = new Set();
      data.forEach(function (details, id) {
        if (!id.startsWith("techniques/")) return;
        var nodeTags = details.tags || [];
        if (beltFilter !== "all" && nodeTags.indexOf(beltFilter) === -1) return;
        if (familyFilter !== "all" && nodeTags.indexOf(familyFilter) === -1) return;
        if (!progressMatches(id)) return;
        matchingTechniques.add(id);
        contextualNodes.add(id);
        var outgoing = details.links || [];
        for (var i = 0; i < outgoing.length; i++) {
          contextualNodes.add(simplifySlug(outgoing[i]));
        }
      });

      var filteredData = new Map();
      data.forEach(function (details, id) {
        if (!/^(techniques|positions|movements|submissions|families|study)\//.test(id)) return;
        var typeMatches = typeFilter === "all" || id.startsWith(typeFilter);
        var contextMatches = !hasContextFilter || contextualNodes.has(id);
        if (typeMatches && contextMatches) filteredData.set(id, details);
      });
      data = filteredData;

      var countEl = graphRoot?.querySelector(".graph-filter-count");
      if (countEl) countEl.textContent = data.size + " nodes";

      var width = graph.offsetWidth;
      var height = Math.max(graph.offsetHeight, 250);

      var links = [];
      var allTags = [];
      var validLinks = new Set(data.keys());

      data.forEach(function (details, source) {
        var outgoing = details.links || [];
        for (var i = 0; i < outgoing.length; i++) {
          var dest = simplifySlug(outgoing[i]);
          if (validLinks.has(dest)) {
            links.push({ source: source, target: dest });
          }
        }

        if (showTags) {
          var tags = details.tags || [];
          for (var i = 0; i < tags.length; i++) {
            var tag = tags[i];
            if (removeTags.indexOf(tag) === -1) {
              var tagSlug = simplifySlug("tags/" + tag);
              if (allTags.indexOf(tagSlug) === -1) {
                allTags.push(tagSlug);
              }
              links.push({ source: source, target: tagSlug });
            }
          }
        }
      });

      var neighbourhood = new Set();
      if (depth >= 0) {
        var queue = [slug];
        var seen = new Set([slug]);
        for (var d = 0; d <= depth && queue.length > 0; d++) {
          var nextQueue = [];
          for (var qi = 0; qi < queue.length; qi++) {
            var cur = queue[qi];
            neighbourhood.add(cur);
            for (var li = 0; li < links.length; li++) {
              var link = links[li];
              if (link.source === cur && !seen.has(link.target)) {
                seen.add(link.target);
                nextQueue.push(link.target);
              }
              if (link.target === cur && !seen.has(link.source)) {
                seen.add(link.source);
                nextQueue.push(link.source);
              }
            }
          }
          queue = nextQueue;
        }
      } else {
        validLinks.forEach(function (id) {
          neighbourhood.add(id);
        });
        for (var i = 0; i < allTags.length; i++) {
          neighbourhood.add(allTags[i]);
        }
      }

      var nodes = [];
      var nodeMap = new Map();
      neighbourhood.forEach(function (url) {
        var isTag = url.startsWith("tags/");
        var text = isTag ? "#" + url.substring(5) : data.get(url)?.title || url;
        var nodeTags = isTag ? [] : data.get(url)?.tags || [];
        var node = {
          id: url,
          text: text,
          tags: nodeTags,
          x: Math.random() * width - width / 2,
          y: Math.random() * height - height / 2,
          vx: 0,
          vy: 0,
        };
        nodes.push(node);
        nodeMap.set(url, node);
      });

      var graphLinks = [];
      for (var i = 0; i < links.length; i++) {
        var link = links[i];
        if (neighbourhood.has(link.source) && neighbourhood.has(link.target)) {
          var sourceNode = nodeMap.get(link.source);
          var targetNode = nodeMap.get(link.target);
          if (sourceNode && targetNode) {
            graphLinks.push({ source: sourceNode, target: targetNode });
          }
        }
      }

      var styles = getComputedStyle(document.documentElement);
      var secondary = resolveColor(styles.getPropertyValue("--secondary").trim(), "#c792ea");
      var tertiary = resolveColor(styles.getPropertyValue("--tertiary").trim(), "#82aaff");
      var gray = resolveColor(styles.getPropertyValue("--gray").trim(), "#6c6c6c");
      var lightgray = resolveColor(styles.getPropertyValue("--lightgray").trim(), "#d4d4d4");
      var dark = resolveColor(styles.getPropertyValue("--dark").trim(), "#1a1a1a");
      var light = resolveColor(styles.getPropertyValue("--light").trim(), "#f5f5f5");
      var bodyFont = styles.getPropertyValue("--bodyFont").trim() || "inherit";
      var blueBelt = resolveColor(styles.getPropertyValue("--belt-blue").trim(), "#176ec0");
      var purpleBelt = resolveColor(styles.getPropertyValue("--belt-purple").trim(), "#7343a4");
      var brownBelt = resolveColor(styles.getPropertyValue("--belt-brown").trim(), "#76503a");
      var positionColor = resolveColor(
        styles.getPropertyValue("--node-position").trim(),
        "#20a4c5",
      );
      var movementColor = resolveColor(
        styles.getPropertyValue("--node-movement").trim(),
        "#535ad7",
      );
      var submissionColor = resolveColor(
        styles.getPropertyValue("--node-submission").trim(),
        "#d96d34",
      );

      var app = new PIXI.Application();
      await app.init({
        width: width,
        height: height,
        antialias: true,
        backgroundAlpha: 0,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        eventMode: "static",
      });
      if (stale()) {
        try {
          app.destroy(true);
        } catch (_) {}
        return function () {};
      }

      graph.appendChild(app.canvas);

      var stage = new PIXI.Container();
      app.stage.addChild(stage);

      var simulation = d3
        .forceSimulation(nodes)
        .force("charge", d3.forceManyBody().strength(-100 * repelForce))
        .force("center", d3.forceCenter().strength(centerForce))
        .force("link", d3.forceLink(graphLinks).distance(linkDistance))
        .force(
          "collide",
          d3
            .forceCollide()
            .radius(function (d) {
              var numLinks = 0;
              for (var i = 0; i < graphLinks.length; i++) {
                if (graphLinks[i].source.id === d.id || graphLinks[i].target.id === d.id) {
                  numLinks++;
                }
              }
              return 2 + Math.sqrt(numLinks);
            })
            .iterations(3),
        );

      if (enableRadial) {
        var radius = (Math.min(width, height) / 2) * 0.8;
        simulation.force("radial", d3.forceRadial(radius).strength(0.2));
      }

      var linkContainer = new PIXI.Container();
      var nodesContainer = new PIXI.Container();
      var labelsContainer = new PIXI.Container();
      stage.addChild(linkContainer);
      stage.addChild(nodesContainer);
      stage.addChild(labelsContainer);

      var nodeRenderData = [];
      var linkRenderData = [];
      var hoveredNodeId = null;
      var hoveredNeighbours = new Set();
      var dragStartTime = 0;
      var dragging = false;
      var currentTransform = d3.zoomIdentity;

      function nodeRadius(d) {
        var numLinks = 0;
        for (var i = 0; i < graphLinks.length; i++) {
          if (graphLinks[i].source.id === d.id || graphLinks[i].target.id === d.id) {
            numLinks++;
          }
        }
        return 2 + Math.sqrt(numLinks);
      }

      function nodeColor(d) {
        var isCurrent = d.id === slug;
        if (isCurrent) {
          return secondary;
        } else if (d.tags.indexOf("exam/blue-belt") !== -1) {
          return blueBelt;
        } else if (d.tags.indexOf("exam/purple-belt") !== -1) {
          return purpleBelt;
        } else if (d.tags.indexOf("exam/brown-belt-only") !== -1) {
          return brownBelt;
        } else if (d.id.startsWith("positions/")) {
          return positionColor;
        } else if (d.id.startsWith("movements/")) {
          return movementColor;
        } else if (d.id.startsWith("submissions/")) {
          return submissionColor;
        } else if (visited.has(d.id) || d.id.startsWith("tags/")) {
          return tertiary;
        } else {
          return gray;
        }
      }

      function updateHoverInfo(newHoveredId) {
        hoveredNodeId = newHoveredId;

        if (newHoveredId === null) {
          hoveredNeighbours = new Set();
          for (var i = 0; i < nodeRenderData.length; i++) {
            nodeRenderData[i].active = false;
          }
          for (var i = 0; i < linkRenderData.length; i++) {
            linkRenderData[i].active = false;
          }
        } else {
          hoveredNeighbours = new Set();

          for (var i = 0; i < linkRenderData.length; i++) {
            var linkData = linkRenderData[i].simulationData;
            if (linkData.source.id === newHoveredId || linkData.target.id === newHoveredId) {
              hoveredNeighbours.add(linkData.source.id);
              hoveredNeighbours.add(linkData.target.id);
              linkRenderData[i].active = true;
            } else {
              linkRenderData[i].active = false;
            }
          }

          hoveredNeighbours.add(newHoveredId);

          for (var i = 0; i < nodeRenderData.length; i++) {
            if (hoveredNeighbours.has(nodeRenderData[i].simulationData.id)) {
              nodeRenderData[i].active = true;
            } else {
              nodeRenderData[i].active = false;
            }
          }
        }
      }

      function renderLinks() {
        for (var i = 0; i < linkRenderData.length; i++) {
          var linkData = linkRenderData[i];
          var alpha = 1;
          if (hoveredNodeId !== null) {
            alpha = linkData.active ? 1 : 0.2;
          }
          linkData.alpha = alpha;
          linkData.color = linkData.active ? gray : lightgray;
        }
      }

      function renderLabels() {
        var defaultScale = 1 / scale;
        var activeScale = defaultScale * 1.1;

        for (var i = 0; i < nodeRenderData.length; i++) {
          var nodeData = nodeRenderData[i];
          if (hoveredNodeId === nodeData.simulationData.id) {
            nodeData.label.alpha = 1;
            nodeData.label.scale.set(activeScale);
          } else {
            nodeData.label.scale.set(defaultScale);
          }
        }
      }

      function renderNodes() {
        for (var i = 0; i < nodeRenderData.length; i++) {
          var nodeData = nodeRenderData[i];
          var alpha = 1;
          if (hoveredNodeId !== null && focusOnHover) {
            alpha = nodeData.active ? 1 : 0.2;
          }
          nodeData.gfx.alpha = alpha;
        }
      }

      function renderPixiFromD3() {
        renderNodes();
        renderLinks();
        renderLabels();
      }

      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var nodeId = node.id;
        var isTagNode = nodeId.startsWith("tags/");
        var radius = nodeRadius(node);
        var color = nodeColor(node);

        var label = new PIXI.Text({
          text: node.text,
          style: {
            fontSize: fontSize * 15,
            fill: dark,
            fontFamily: bodyFont,
          },
          resolution: window.devicePixelRatio * 4,
        });
        label.anchor.set(0.5, 1.2);
        label.alpha = 0;
        label.scale.set(1 / scale);
        labelsContainer.addChild(label);

        var gfx = new PIXI.Graphics();
        gfx.circle(0, 0, radius);
        gfx.fill({ color: isTagNode ? light : color });
        if (isTagNode) {
          gfx.stroke({ width: 2, color: tertiary });
        }

        gfx.eventMode = "static";
        gfx.cursor = "pointer";
        gfx.label = nodeId;

        (function (n, g, labelRef) {
          var oldLabelOpacity = 0;
          g.on("pointerover", function (e) {
            updateHoverInfo(n.id);
            oldLabelOpacity = labelRef.alpha;
            if (!dragging) {
              renderPixiFromD3();
            }
          });

          g.on("pointerleave", function () {
            updateHoverInfo(null);
            labelRef.alpha = oldLabelOpacity;
            if (!dragging) {
              renderPixiFromD3();
            }
          });
        })(node, gfx, label);

        nodesContainer.addChild(gfx);

        nodeRenderData.push({
          simulationData: node,
          gfx: gfx,
          label: label,
          color: color,
          alpha: 1,
          active: false,
        });
      }

      for (var i = 0; i < graphLinks.length; i++) {
        var link = graphLinks[i];
        var gfx = new PIXI.Graphics();
        gfx.eventMode = "none";
        linkContainer.addChild(gfx);

        linkRenderData.push({
          simulationData: link,
          gfx: gfx,
          color: lightgray,
          alpha: 1,
          active: false,
        });
      }

      if (enableDrag) {
        var dragSubject = function (event) {
          var mouseX = (event.x - currentTransform.x) / currentTransform.k;
          var mouseY = (event.y - currentTransform.y) / currentTransform.k;

          for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            var dx = mouseX - n.x - width / 2;
            var dy = mouseY - n.y - height / 2;
            var dist = Math.sqrt(dx * dx + dy * dy);
            var rad = nodeRadius(n);
            if (dist < rad + 5) {
              return n;
            }
          }
          return null;
        };

        var dragStarted = function (event) {
          if (!event.active) simulation.alphaTarget(1).restart();
          event.subject.fx = event.subject.x;
          event.subject.fy = event.subject.y;
          var mouseSimX = (event.x - currentTransform.x) / currentTransform.k - width / 2;
          var mouseSimY = (event.y - currentTransform.y) / currentTransform.k - height / 2;
          event.subject.__dragOffset = {
            x: mouseSimX - event.subject.x,
            y: mouseSimY - event.subject.y,
          };
          dragStartTime = Date.now();
          dragging = true;
          hoveredNodeId = event.subject.id;
        };

        var dragDragged = function (event) {
          var mouseSimX = (event.x - currentTransform.x) / currentTransform.k - width / 2;
          var mouseSimY = (event.y - currentTransform.y) / currentTransform.k - height / 2;
          event.subject.fx = mouseSimX - event.subject.__dragOffset.x;
          event.subject.fy = mouseSimY - event.subject.__dragOffset.y;
        };

        var dragEnded = function (event) {
          if (!event.active) simulation.alphaTarget(0);
          event.subject.fx = null;
          event.subject.fy = null;
          dragging = false;
          updateHoverInfo(null);
          renderPixiFromD3();

          if (Date.now() - dragStartTime < 500) {
            navigateToNode(event.subject.id);
          }
        };

        var drag = d3
          .drag()
          .container(app.canvas)
          .subject(dragSubject)
          .on("start", dragStarted)
          .on("drag", dragDragged)
          .on("end", dragEnded);

        d3.select(app.canvas).call(drag);
      } else {
        for (var i = 0; i < nodeRenderData.length; i++) {
          (function (nodeData) {
            nodeData.gfx.on("click", function () {
              navigateToNode(nodeData.simulationData.id);
            });
          })(nodeRenderData[i]);
        }
      }

      if (enableZoom) {
        var zoomed = function (event) {
          currentTransform = event.transform;
          stage.scale.set(currentTransform.k, currentTransform.k);
          stage.position.set(currentTransform.x, currentTransform.y);

          var newScale = currentTransform.k * opacityScale;
          var scaleOpacity = Math.max((newScale - 1) / 3.75, 0);

          var activeLabels = [];
          for (var i = 0; i < nodeRenderData.length; i++) {
            if (nodeRenderData[i].active) {
              activeLabels.push(nodeRenderData[i].label);
            }
          }

          for (var i = 0; i < labelsContainer.children.length; i++) {
            var label = labelsContainer.children[i];
            if (activeLabels.indexOf(label) === -1) {
              label.alpha = scaleOpacity;
            }
          }
        };

        var zoom = d3
          .zoom()
          .extent([
            [0, 0],
            [width, height],
          ])
          .scaleExtent([0.25, 4])
          .on("zoom", zoomed);

        d3.select(app.canvas).call(zoom);
      }

      var stopAnimation = false;
      function animate() {
        if (stopAnimation) return;

        for (var i = 0; i < nodeRenderData.length; i++) {
          var n = nodeRenderData[i];
          var x = n.simulationData.x;
          var y = n.simulationData.y;
          if (x != null && y != null) {
            n.gfx.position.set(x + width / 2, y + height / 2);
            if (n.label) {
              n.label.position.set(x + width / 2, y + height / 2);
            }
          }
        }

        for (var i = 0; i < linkRenderData.length; i++) {
          var l = linkRenderData[i];
          var linkData = l.simulationData;
          var sx = linkData.source.x;
          var sy = linkData.source.y;
          var tx = linkData.target.x;
          var ty = linkData.target.y;
          if (sx != null && sy != null && tx != null && ty != null) {
            l.gfx.clear();
            l.gfx.moveTo(sx + width / 2, sy + height / 2);
            l.gfx.lineTo(tx + width / 2, ty + height / 2);
            l.gfx.stroke({ alpha: l.alpha, width: 1, color: l.color });
          }
        }

        requestAnimationFrame(animate);
      }

      simulation.on("tick", function () {});
      simulation.restart();
      renderPixiFromD3();
      animate();

      return function () {
        stopAnimation = true;
        simulation.stop();
        try {
          app.destroy(true);
        } catch (_) {
          // PixiJS may throw if WebGL context was already lost.
        }
      };
    }

    var localCleanups = [];
    var globalCleanups = [];
    var currentRenderGeneration = 0;
    var currentGlobalGeneration = 0;
    var filterControls = [];
    var scheduledNavFrame = 0;
    var globalTrigger = null;

    function navigateToNode(slug) {
      var target = new URL(resolveBasePath(slug), window.location.origin);
      if (window.spaNavigate) window.spaNavigate(target, false);
      else window.location.assign(target.toString());
    }

    function cleanupLocal() {
      currentRenderGeneration++;
      for (var i = 0; i < localCleanups.length; i++) {
        localCleanups[i]();
      }
      localCleanups = [];
    }

    function cleanupGlobal() {
      currentGlobalGeneration++;
      for (var i = 0; i < globalCleanups.length; i++) {
        globalCleanups[i]();
      }
      globalCleanups = [];
    }

    function detachFilterControls() {
      for (var i = 0; i < filterControls.length; i++) {
        filterControls[i].removeEventListener("change", handleFilterChange);
      }
      filterControls = [];
    }

    var globalContainers = [];
    var globalIcons = [];
    var documentClickHandler = null;
    var documentKeydownHandler = null;
    var iconClickHandler = null;

    function hideGlobalGraph() {
      cleanupGlobal();
      for (var i = 0; i < globalContainers.length; i++) {
        globalContainers[i].classList.remove("active");
        var sidebar = globalContainers[i].closest(".sidebar");
        if (sidebar) {
          sidebar.style.zIndex = "";
        }
      }
      if (globalTrigger && globalTrigger.isConnected) globalTrigger.focus();
      globalTrigger = null;
    }

    function anyGlobalGraphActive() {
      for (var i = 0; i < globalContainers.length; i++) {
        if (globalContainers[i].classList.contains("active")) {
          return true;
        }
      }
      return false;
    }

    function showGlobalGraph(focusDialog) {
      cleanupGlobal();
      var thisGeneration = ++currentGlobalGeneration;
      var currentSlug = getSlugFromUrl();
      for (var i = 0; i < globalContainers.length; i++) {
        var container = globalContainers[i];
        container.classList.add("active");
        var sidebar = container.closest(".sidebar");
        if (sidebar) {
          sidebar.style.zIndex = "1";
        }

        var graphContainer = container.querySelector(".global-graph-container");
        if (graphContainer) {
          (function (gc) {
            renderGraph(gc, currentSlug, function () {
              return thisGeneration === currentGlobalGeneration;
            })
              .then(function (cleanup) {
                if (thisGeneration === currentGlobalGeneration) globalCleanups.push(cleanup);
                else cleanup();
              })
              .catch(function (err) {
                console.error("[Graph] Global render error:", err);
              });
          })(graphContainer);
        }
      }
      if (focusDialog) {
        window.requestAnimationFrame(function () {
          document.querySelector(".global-graph-outer.active .global-graph-close")?.focus();
        });
      }
    }

    function toggleGlobalGraph() {
      if (anyGlobalGraphActive()) {
        hideGlobalGraph();
      } else {
        showGlobalGraph(true);
      }
    }

    function renderLocal() {
      cleanupLocal();
      var thisGeneration = ++currentRenderGeneration;
      var slug = getSlugFromUrl();
      addToVisited(slug);

      var localContainers = document.querySelectorAll(".graph-container");
      for (var i = 0; i < localContainers.length; i++) {
        (function (container) {
          renderGraph(container, slug, function () {
            return thisGeneration === currentRenderGeneration;
          })
            .then(function (cleanup) {
              if (thisGeneration === currentRenderGeneration) {
                localCleanups.push(cleanup);
              } else cleanup();
            })
            .catch(function (err) {
              console.error("[Graph] Local render error:", err);
            });
        })(localContainers[i]);
      }
    }

    function handleFilterChange() {
      renderLocal();
      if (anyGlobalGraphActive()) showGlobalGraph(false);
    }

    function handleNav() {
      var slug = getSlugFromUrl();
      addToVisited(simplifySlug(slug));

      renderLocal();

      globalContainers = Array.from(document.querySelectorAll(".global-graph-outer"));

      if (iconClickHandler) {
        for (var i = 0; i < globalIcons.length; i++) {
          globalIcons[i].removeEventListener("click", iconClickHandler);
        }
      }

      globalIcons = Array.from(document.querySelectorAll(".global-graph-icon"));
      iconClickHandler = function (event) {
        globalTrigger = event.currentTarget;
        toggleGlobalGraph();
      };
      for (var i = 0; i < globalIcons.length; i++) {
        globalIcons[i].addEventListener("click", iconClickHandler);
      }

      if (documentClickHandler) {
        document.removeEventListener("click", documentClickHandler);
      }
      documentClickHandler = function (e) {
        if (anyGlobalGraphActive()) {
          var target = e.target instanceof Element ? e.target : null;
          var inContainer = target?.closest(".global-graph-container");
          var inIcon = target?.closest(".global-graph-icon");
          if (!inContainer && !inIcon) {
            hideGlobalGraph();
          }
        }
      };
      document.addEventListener("click", documentClickHandler);

      if (documentKeydownHandler) {
        document.removeEventListener("keydown", documentKeydownHandler);
      }
      documentKeydownHandler = function (e) {
        if (e.key === "Escape") {
          if (anyGlobalGraphActive()) {
            hideGlobalGraph();
          }
          return;
        }

        if (e.key === "g" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
          e.preventDefault();
          toggleGlobalGraph();
        }
      };
      document.addEventListener("keydown", documentKeydownHandler);

      if (anyGlobalGraphActive()) {
        showGlobalGraph(false);
      }

      detachFilterControls();
      filterControls = Array.from(
        document.querySelectorAll(".graph > .graph-filters [data-graph-filter]"),
      );
      for (var fi = 0; fi < filterControls.length; fi++) {
        filterControls[fi].addEventListener("change", handleFilterChange);
      }
    }

    function scheduleHandleNav() {
      window.cancelAnimationFrame(scheduledNavFrame);
      scheduledNavFrame = window.requestAnimationFrame(handleNav);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        scheduleHandleNav();
      });
    } else {
      scheduleHandleNav();
    }
    document.addEventListener("prenav", function () {
      window.cancelAnimationFrame(scheduledNavFrame);
      detachFilterControls();
      cleanupLocal();
      cleanupGlobal();
    });
    document.addEventListener("nav", scheduleHandleNav);
    document.addEventListener("render", scheduleHandleNav);
    window.addEventListener("grapplegraph-progress", handleFilterChange);

    function handleThemeChange() {
      renderLocal();
      if (anyGlobalGraphActive()) {
        showGlobalGraph(false);
      }
    }
    document.addEventListener("themechange", handleThemeChange);
  }
})();
